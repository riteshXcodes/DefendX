import { v4 as uuid } from "uuid";
import { prisma } from "../lib/db"
import { emitState } from "../websocket/socket";
import { fetchLogs } from "./loki";
import { runAnalysis } from "./agent";
import { notifySlack, createJiraTicket, sendEmailReport } from "./remediation";
import { JobState } from "../core/stateMachine";
import { ActionType, Domain } from "../generated/prisma/enums";

const DOMAINS = ["http", "infra", "auth"] as const;

export async function runJob(windowMinutes = 60) {
    const jobId = uuid();
    const windowTo = Date.now();
    const windowFrom = windowTo - windowMinutes * 60 * 1000;

    // ── 1. Create job record ────────────────────────────────────────────────
    await prisma.job.create({
        data: {
            jobId,
            status: "FETCHING",
            windowFrom: BigInt(windowFrom),
            windowTo: BigInt(windowTo),
        },
    });

    emitState(jobId, JobState.FETCHING, { windowFrom, windowTo });

    // ── 2. Fetch logs from Loki ─────────────────────────────────────────────
    const logs: Record<string, string[]> = {};
    let totalLogs = 0;

    for (const domain of DOMAINS) {
        const lines = await fetchLogs().catch(() => [] as string[]);
        logs[domain] = lines;
        totalLogs += lines.length;
        emitState(jobId, JobState.FETCHING, { domain, count: lines.length });
    }

    await prisma.job.update({
        where: { jobId },
        data: { totalLogs, status: "ANALYZING" },
    });

    emitState(jobId, JobState.ANALYZING, { totalLogs });

    // ── 3. AI analysis ──────────────────────────────────────────────────────
    let agentOutput;
    try {
        agentOutput = await runAnalysis(logs, windowFrom, windowTo);
    } catch (err: any) {
        await prisma.job.update({ where: { jobId }, data: { status: "ERROR" } });
        emitState(jobId, JobState.ERROR, { message: err.message });
        return;
    }

    // ── 4. Persist findings ─────────────────────────────────────────────────
    const findings = agentOutput.findings ?? [];

    await prisma.finding.createMany({
        data: findings.map((f) => ({
            jobId,
            findingId: f.finding_id,
            domain: f.domain,
            classification: f.classification,
            severity: f.severity,
            confidence: f.confidence,
            offender: f.offender,
            metrics: f.metrics,
            timeWindowFrom: BigInt(f.time_window.from),
            timeWindowTo: BigInt(f.time_window.to),
            evidenceSamples: f.evidence_samples,
            summary: f.summary,
            context: f.context,
        })),
    });

    // ── 5. Domain stats ─────────────────────────────────────────────────────
    for (const domain of DOMAINS) {
        const domainFindings = findings.filter((f) => f.domain === domain).length;
        await prisma.domainStat.upsert({
            where: { jobId_domain: { jobId, domain } },
            create: { jobId, domain, logsProcessed: logs[domain].length, findingsCount: domainFindings },
            update: { logsProcessed: logs[domain].length, findingsCount: domainFindings },
        });
    }

    emitState(jobId, JobState.ANALYZING, { findings: agentOutput });

    // ── 6. Remediation ──────────────────────────────────────────────────────
    await prisma.job.update({ where: { jobId }, data: { status: "REMEDIATING" } });
    emitState(jobId, JobState.REMEDIATING, { findingsCount: findings.length });

    const remediationSteps = buildRemediationSteps(findings);

    for (const step of remediationSteps) {
        const action = await prisma.action.create({
            data: {
                jobId,
                findingId: step.findingId,
                domain: step.domain as Domain,
                actionType: step.actionType as ActionType,
                description: step.description,
                status: "IN_PROGRESS",
            },
        });

        // Simulate / execute the action
        await executeAction(step);

        await prisma.action.update({
            where: { id: action.id },
            data: { status: "DONE", completedAt: new Date() },
        });

        emitState(jobId, JobState.REMEDIATING, {
            actionId: action.id,
            description: step.description,
            done: true,
        });
    }

    // ── 7. Persist report ───────────────────────────────────────────────────
    await prisma.report.create({
        data: {
            jobId,
            jsonReport: agentOutput as any,
            humanReport: agentOutput.soc_report,
        },
    });

    await prisma.job.update({
        where: { jobId },
        data: {
            status: "COMPLETED",
            findingsCount: findings.length,
            actionsCount: remediationSteps.length,
            completedAt: new Date(),
        },
    });

    // ── 8. Update global stats ──────────────────────────────────────────────
    await prisma.globalStat.upsert({
        where: { id: "singleton" },
        create: {
            totalJobs: 1,
            totalLogs: totalLogs,
            totalFindings: findings.length,
            totalActions: remediationSteps.length,
        },
        update: {
            totalJobs: { increment: 1 },
            totalLogs: { increment: totalLogs },
            totalFindings: { increment: findings.length },
            totalActions: { increment: remediationSteps.length },
            lastUpdated: new Date(),
        },
    });

    // ── 9. Notify ───────────────────────────────────────────────────────────
    const summary = `${findings.length} finding(s), ${remediationSteps.length} action(s) taken.`;
    await Promise.allSettled([
        notifySlack(jobId, summary),
        createJiraTicket(jobId, findings),
        sendEmailReport(jobId, agentOutput.soc_report),
    ]);

    emitState(jobId, JobState.COMPLETED, {
        findingsCount: findings.length,
        actionsCount: remediationSteps.length,
        report: { jsonReport: agentOutput, humanReport: agentOutput.soc_report },
    });
}

// ── Remediation helpers ─────────────────────────────────────────────────────

interface RemediationStep {
    findingId: string;
    domain: string;
    actionType: string;
    description: string;
}

function buildRemediationSteps(findings: any[]): RemediationStep[] {
    const steps: RemediationStep[] = [];

    for (const f of findings) {
        switch (f.classification) {
            case "brute_force":
                steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "block_ip", description: `Block offender ${f.offender.value} (brute force on ${f.domain})` });
                steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "alert_soc", description: `Alert SOC for finding ${f.finding_id}` });
                break;
            case "resource_exhaustion":
                steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "rate_limit", description: `Apply rate-limit for ${f.offender.value} on ${f.domain}` });
                break;
            case "port_scan":
                steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "block_ip", description: `Block scanner ${f.offender.value}` });
                break;
            default:
                steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "alert_soc", description: `Manual review needed for ${f.finding_id}` });
        }
    }

    return steps;
}

async function executeAction(step: RemediationStep) {
    // Wire real firewall / rate-limiter calls here.
    // For now resolves immediately — replace with actual integrations.
    return Promise.resolve();
}