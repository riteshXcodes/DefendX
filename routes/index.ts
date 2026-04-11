import { Router } from "express";
import { prisma } from "../lib/db";
import { runJob } from "../lib/jobRunner";
import { pushLogs } from "../lib/loki";
import { formatJobsBatch } from "../utils/jobformatter";
export const router = Router();

router.post("/pushLogs", async (req, res) => {
    const { streams } = req.body;
    try {
        await pushLogs(streams);
        res.json({ status: "success", ingested_streams: streams.length });
    } catch (err) {
        res.status(500).json({ error: "Failed to push logs" });
    }
});

// ── Trigger a new analysis job ──────────────────────────────────────────────
router.post("/jobs/trigger", async (req, res) => {
    const { windowMinutes = 10 } = req.body;
    // Fire and forget — client tracks progress via WebSocket
    runJob(windowMinutes).catch(console.error);
    res.json({ message: "Job triggered" });
});

// ── Get single job status ───────────────────────────────────────────────────
router.get("/jobs/:jobId", async (req, res) => {
    const job = await prisma.job.findUnique({
        where: { jobId: req.params.jobId },
        include: { findings: true, actions: true, report: true, domainStats: true },
    });
    if (!job) return res.status(404).json({ error: "Not found" });
    res.json(job);
});

// ── Dashboard — global summary + per-domain breakdown ──────────────────────
router.get("/dashboard", async (_req, res) => {
    const [globalStat, domainAgg, recentJobs] = await Promise.all([
        prisma.globalStat.findUnique({ where: { id: "singleton" } }),

        prisma.domainStat.groupBy({
            by: ["domain"],
            _sum: { logsProcessed: true, findingsCount: true, actionsCount: true },
        }),

        prisma.job.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                jobId: true, status: true, totalLogs: true,
                findingsCount: true, actionsCount: true,
                createdAt: true, completedAt: true,
            },
        }),
    ]);

    res.json({ globalStat, domainBreakdown: domainAgg, recentJobs });
});

// ── Incident history — all actions taken, paginated ────────────────────────
router.get("/incidents", async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const [total, actions] = await Promise.all([
        prisma.action.count(),
        prisma.action.findMany({
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: { job: { select: { jobId: true, status: true } } },
        }),
    ]);

    res.json({ total, page, limit, actions });
});

// ── Reports — list all ─────────────────────────────────────────────────────
router.get("/reports", async (req, res) => {
    const reports = await prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true, jobId: true, createdAt: true,
            job: { select: { findingsCount: true, actionsCount: true, status: true } },
        },
    });
    res.json(reports);
});

// ── Single report ───────────────────────────────────────────────────────────
router.get("/reports/:jobId", async (req, res) => {
    const report = await prisma.report.findUnique({
        where: { jobId: req.params.jobId },
        include: { job: { include: { findings: true, actions: true } } },
    });
    if (!report) return res.status(404).json({ error: "Not found" });
    res.json(report);
});

//--All Jobs---

router.get("/allJobs", async (req, res) => {
    const jobs = await prisma.job.findMany();

    const formattedJobs = formatJobsBatch(jobs, "iso"); // or "locale"

    res.json(formattedJobs);
});
