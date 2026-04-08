import axios from "axios";
import nodemailer from "nodemailer";

// ── Slack ──────────────────────────────────────────────────────────────────
export async function notifySlack(jobId: string, summary: string) {
    if (!process.env.SLACK_WEBHOOK_URL) return;
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
        text: `*DefendX — Remediation complete* | Job \`${jobId}\`\n${summary}`,
    });
}

// ── Jira ───────────────────────────────────────────────────────────────────
export async function createJiraTicket(jobId: string, findings: any[]) {
    if (!process.env.JIRA_BASE_URL) return;
    const description = findings
        .map((f) => `- [${f.severity.toUpperCase()}] ${f.summary}`)
        .join("\n");

    await axios.post(
        `${process.env.JIRA_BASE_URL}/rest/api/3/issue`,
        {
            fields: {
                project: { key: process.env.JIRA_PROJECT_KEY },
                summary: `DefendX: ${findings.length} finding(s) — Job ${jobId}`,
                description: { version: 1, type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: description }] }] },
                issuetype: { name: "Bug" },
            },
        },
        {
            auth: {
                username: process.env.JIRA_EMAIL!,
                password: process.env.JIRA_API_TOKEN!,
            },
            headers: { "Content-Type": "application/json" },
        }
    );
}

// ── Email ──────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendEmailReport(jobId: string, humanReport: string) {
    if (!process.env.ALERT_EMAIL_TO) return;
    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.ALERT_EMAIL_TO,
        subject: `DefendX SOC Report — Job ${jobId}`,
        text: humanReport,
    });
}