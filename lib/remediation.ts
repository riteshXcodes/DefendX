import axios from "axios";
import nodemailer from "nodemailer";

import dotenv from "dotenv";
dotenv.config();

// ── Slack ──────────────────────────────────────────────────────────────────
export async function notifySlack(jobId: string, summary: string,classification:string , severity: string ,recommended_action: string) {
    if (!process.env.SLACK_WEBHOOK_URL) return;
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
       
        text: `*DefendX — Remediation complete* | Job \`${jobId}\`\n${summary} \`${classification}\`\n${severity} \`\n${recommended_action}`,
    });
}

// notifySlack( "12344","dnjjf");

// ── Jira ───────────────────────────────────────────────────────────────────
export async function createJiraTicket(jobId: string, findings: any[]) {
    if (!process.env.JIRA_BASE_URL) return;

    try {
        const description = findings
            .map(
                (f) =>
                    `- [${(f.severity || "UNKNOWN").toUpperCase()}] ${
                        f.summary || "No summary"
                    }`
            )
            .join("\n");

        const res = await axios.post(
            `${process.env.JIRA_BASE_URL}/rest/api/3/issue`,
            {
                fields: {
                    project: { key: process.env.JIRA_PROJECT_KEY },
                    summary: `DefendX: ${findings.length} finding(s) — Job ${jobId}`,
                    description: {
                        version: 1,
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    {
                                        type: "text",
                                        text: description,
                                    },
                                ],
                            },
                        ],
                    },
                    issuetype: { name: "Task" }
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

        console.log("✅ Jira ticket created:", res.data);
        return res.data;

    } catch (error: any) {
        console.error(
            "FULL JIRA ERROR:",
            JSON.stringify(error.response?.data, null, 2)
        );
        throw error;
    }
}

export async function blockIpOnCloudflare(ip: string, note: string = "Blocked by defendx automation") {
 
  if (
    !process.env.CF_ZONE_ID ||
    !process.env.CF_API_TOKEN ||
    !process.env.CF_ACCOUNT_ID
  ) {
    throw new Error(
      "Missing Cloudflare env vars: CF_ZONE_ID, CF_API_TOKEN, CF_ACCOUNT_ID"
    );
  }

  try {
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/firewall/access_rules/rules`,
      {
        mode: "block",
        configuration: {
          target: "ip",
          value: ip,
        },
        notes: note,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Cloudflare blocked IP: ${ip}`);
    return response.data;
  } catch (error: any) {
    console.error(
      "❌ Failed to block IP on Cloudflare:",
      error.response?.data || error.message
    );
    throw error;
  }
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