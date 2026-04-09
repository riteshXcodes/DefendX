import { v4 as uuid } from "uuid";
import { prisma } from "../lib/db"
import { emitState } from "../websocket/socket";
import { fetchLogs } from "./loki";
import { runAnalysis } from "./agent";
import { notifySlack, createJiraTicket, sendEmailReport , blockIpOnCloudflare } from "./remediation";
import { JobState } from "../core/stateMachine";
import { ActionType, Domain, Severity } from "../generated/prisma/enums";
import { notEqual } from "assert";

const DOMAINS = ["http", "infra", "auth"] as const;

export async function runJob(windowMinutes = 60) {
    const jobId = uuid();
    const windowTo = Date.now() * 1_000_000;
    const windowFrom = windowTo - (24 * windowMinutes * 60 * 1_000_000_000);

    console.log(`\n🚀 [JOB START] ${jobId}`);
    console.log(`🕒 Window: ${windowMinutes}m`);

    // ── 1. Create job record ────────────────────────────────────────────────
    await prisma.job.create({
        data: {
            jobId,
            status: "FETCHING",
            windowFrom: BigInt(windowFrom),
            windowTo: BigInt(windowTo),
        },
    });
    console.log(`✅ [PHASE 1 COMPLETE] Job created`);

    emitState(jobId, JobState.FETCHING, { windowFrom, windowTo });

    // ── 2. Fetch logs ───────────────────────────────────────────────────────
    const logs: Record<string, string[]> = {};
    let totalLogs = 0;

    for (const domain of DOMAINS) {
        const lines = await fetchLogs(domain, windowFrom, windowTo).catch(() => [] as string[]);
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
        console.log(`✅ [PHASE 3 COMPLETE] Analysis done | Findings: ${agentOutput.findings?.length || 0}`);
    } catch (err: any) {
        console.error(`❌ [PHASE 3 FAILED] Analysis error: ${err.message}`);
        await prisma.job.update({ where: { jobId }, data: { status: "ERROR" } });
        emitState(jobId, JobState.ERROR, { message: err.message });
        return;
    }

    // ── 4. Persist findings ─────────────────────────────────────────────────
    const findings = agentOutput.findings ?? [];

    if (findings.length > 0) {
        await prisma.finding.createMany({
            data: findings.map((f) => ({
                jobId,
                findingId: f.finding_id,
                domain: f.domain as Domain,
                classification: f.classification,
                severity: f.severity as Severity,
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
    }

    console.log(`✅ [PHASE 4 COMPLETE] Findings stored`);

    // ── 5. Domain stats ─────────────────────────────────────────────────────
    for (const domain of DOMAINS) {
        const domainFindings = findings.filter((f) => f.domain === domain).length;
        await prisma.domainStat.upsert({
            where: { jobId_domain: { jobId, domain } },
            create: { jobId, domain, logsProcessed: logs[domain].length, findingsCount: domainFindings },
            update: { logsProcessed: logs[domain].length, findingsCount: domainFindings },
        });
    }

    console.log(`✅ [PHASE 5 COMPLETE] Domain stats updated`);

    emitState(jobId, JobState.ANALYZING, { findings: agentOutput });

    // ── 6. Remediation ──────────────────────────────────────────────────────
    await prisma.job.update({ where: { jobId }, data: { status: "REMEDIATING" } });

    const remediationSteps = buildRemediationSteps(findings);
    console.log(`⚙️ [REMEDIATION] Actions planned: ${remediationSteps.length}`);

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
try{

     const finding = findings.find(
            (f) => f.finding_id === step.findingId
        );

    await executeAction(step,finding);

        await prisma.action.update({
            where: { id: action.id },
            data: { status: "DONE", completedAt: new Date() },
        });

}catch(err){
    await prisma.action.update({
      where:{ id: action.id },
      data:{ status:"FAILED" }
   });
}
        
    }

    console.log(`✅ [PHASE 6 COMPLETE] Remediation done`);

    // ── 7. Report ───────────────────────────────────────────────────────────
    await prisma.report.create({
        data: {
            jobId,
            jsonReport: agentOutput as any,
            humanReport: agentOutput.soc_report,
        },
    });

    console.log(`✅ [PHASE 7 COMPLETE] Report saved`);

    // ── 8. Finalize job ─────────────────────────────────────────────────────
    await prisma.job.update({
        where: { jobId },
        data: {
            status: "COMPLETED",
            findingsCount: findings.length,
            actionsCount: remediationSteps.length,
            completedAt: new Date(),
        },
    });

    await prisma.globalStat.upsert({
        where: { id: "singleton" },
        create: {
            totalJobs: 1,
            totalLogs,
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

    console.log(`✅ [PHASE 8 COMPLETE] Job finalized`);

    // ── 9. Notifications ────────────────────────────────────────────────────
    const summary = `${findings.length} finding(s), ${remediationSteps.length} action(s) taken.`;

    await Promise.allSettled([
        createJiraTicket(jobId, findings),
        sendEmailReport(jobId, agentOutput.soc_report),
    ]);

    console.log(`📢 [PHASE 9 COMPLETE] Notifications sent`);

    emitState(jobId, JobState.COMPLETED, {
        findingsCount: findings.length,
        actionsCount: remediationSteps.length,
    });

    console.log(`🎉 [JOB COMPLETE] ${jobId}\n`);
}

// ── Remediation helpers ─────────────────────────────────────────────────────

interface RemediationStep {
    findingId: string;
    domain: string;
    actionType: string;
    description: string;
    offender?: string;
}

// function buildRemediationSteps(findings: any[]): RemediationStep[] {
//     const steps: RemediationStep[] = [];

//     for (const f of findings) {
//         switch (f.classification) {
//             case "brute_force":
//                 steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "block_ip", description: `Block offender ${f.offender.value} (brute force on ${f.domain})` });
//                 steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "alert_soc", description: `Alert SOC for finding ${f.finding_id}` });
//                 break;
//             case "resource_exhaustion":
//                 steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "rate_limit", description: `Apply rate-limit for ${f.offender.value} on ${f.domain}` });
//                 break;
//             case "port_scan":
//                 steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "block_ip", description: `Block scanner ${f.offender.value}` });
//                 break;
//             default:
//                 steps.push({ findingId: f.finding_id, domain: f.domain, actionType: "alert_soc", description: `Manual review needed for ${f.finding_id}` });
//         }
//     }

//     return steps;
// }





function buildRemediationSteps(findings: any[]): RemediationStep[] {
    const steps: RemediationStep[] = [];

    for (const f of findings) {
        const recommendation =
            `${f.classification} ${f.summary} ${f.recommended_action || ""}`
                .toLowerCase();

        // BLOCK IP cases
        if (
            recommendation.includes("block ip") ||
            recommendation.includes("sql injection") ||
            recommendation.includes("credential stuffing") ||
            recommendation.includes("endpoint scanning")
        ) {
            steps.push({
                findingId: f.finding_id,
                domain: f.domain,
                actionType: "block_ip",
                description: `Block offender ${f.offender.value}`
            });
            break;
        }

        // RATE LIMIT cases
        if (
            recommendation.includes("rate limit") ||
            recommendation.includes("resource exhaustion")
        ) {
            steps.push({
                findingId: f.finding_id,
                domain: f.domain,
                actionType: "rate_limit",
                description: `Rate limit ${f.offender.value}`
            });
            
        }

        // RESOURCE SCALE / Jira infra issue
        if (
            recommendation.includes("increase memory") ||
            recommendation.includes("service crash")
        ) {
            steps.push({
                findingId: f.finding_id,
                domain: f.domain,
                actionType: "allocate_resources",
                description: `Allocate infra resources for ${f.offender.value}`
            });
            
        }

        // default SOC alert
        steps.push({
            findingId: f.finding_id,
            domain: f.domain,
            actionType: "alert_soc",
            description: `SOC review for ${f.finding_id}`
        });
    }

    return steps;
}
// async function executeAction(step: RemediationStep) {
//     // Wire real firewall / rate-limiter calls here.
//     // For now resolves immediately — replace with actual integrations.
//     return Promise.resolve();
// }

async function executeAction(step: RemediationStep, finding: any) {

    console.log("executing actions s s");
    switch (step.actionType) {
        case "block_ip":
            console.log(`🔥 Blocking IP`);
             await blockIpOnCloudflare(
                finding?.offender?.value,
                `Blocked due to ${finding?.classification}`
            );
            break;

        case "rate_limit":
            console.log(`🚦 Applying rate limit`);

             await createJiraTicket(
                `rate-limit-${step.findingId}`,
                [finding]
            );
            break;

        case "allocate_resources":
            console.log(`📈 Allocating resources`);
            await createJiraTicket(
                `infra-${step.findingId}`,
                [finding]
            );
            break;

        case "alert_soc":
            console.log(`🚨 Alerting SOC`);

            await notifySlack(
                `
Job ID: ${finding?.finding_id}`,
`Summary: ${finding?.summary}`,
`Classification: ${finding?.classification}`,
`Severity: ${finding?.severity}`,
`Recommended Action: ${finding?.recommended_action}`
            );
            break;

        default:
            console.log(`No action`);
    }

    return Promise.resolve();
}