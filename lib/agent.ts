import { commanderClient, OPENROUTER_MODEL } from "../config/index";

export interface AgentFinding {
    finding_id: string;
    domain: string;
    classification: string;
    severity: string;
    confidence: number;
    context: { service: string; app: string; environment: string };
    offender: { type: string; value: string };
    metrics: {
        event_count: number;
        unique_targets: number;
        success_count: number;
        failure_count: number;
    };
    time_window: { from: number; to: number };
    evidence_samples: string[];
    summary: string;
}

export interface AgentOutput {
    execution_id: string;
    analyzed_time_window: { from: number; to: number };
    findings: AgentFinding[];
    soc_report: string;
}

const SYSTEM_PROMPT = `You are DefendX Commander, a security analysis agent.
Domains in scope: http, infra, auth.

You will receive raw log lines for one or more domains and a time window.
Respond with EXACTLY two sections separated by the delimiter ---SECTION_B---:

SECTION A: a JSON object matching this exact schema (no markdown fences):
{
  "execution_id": "<uuid>",
  "analyzed_time_window": { "from": <epoch_ms>, "to": <epoch_ms> },
  "findings": [
    {
      "finding_id": "INC-001",
      "domain": "http|infra|auth",
      "classification": "brute_force|resource_exhaustion|port_scan|privilege_escalation|anomaly",
      "severity": "critical|high|medium|low",
      "confidence": 0.0-1.0,
      "context": { "service": "...", "app": "...", "environment": "..." },
      "offender": { "type": "ip|user|service", "value": "..." },
      "metrics": { "event_count": 0, "unique_targets": 0, "success_count": 0, "failure_count": 0 },
      "time_window": { "from": <epoch_ms>, "to": <epoch_ms> },
      "evidence_samples": ["..."],
      "summary": "..."
    }
  ]
}

---SECTION_B---

SECTION B: a human-readable SOC markdown report with these headings:
### Executive Summary
### Timeline Overview
### Key Findings
### Risk Assessment
### Observed Trends
### Known Gaps/Limitations
### Monitoring Recommendations
`;

export async function runAnalysis(
    logs: Record<string, string[]>,
    windowFrom: number,
    windowTo: number
): Promise<AgentOutput> {
    const logText = Object.entries(logs)
        .map(([domain, lines]) => `=== ${domain.toUpperCase()} LOGS ===\n${lines.join("\n")}`)
        .join("\n\n");

    const userMessage = `Time window: ${windowFrom} to ${windowTo} (epoch ms)\n\n${logText || "No logs retrieved."}`;

    const { data } = await commanderClient.post("/chat/completions", {
        model: OPENROUTER_MODEL,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
        ],
        temperature: 0,
    });

    const raw: string = data.choices[0].message.content;
    const [jsonPart, socPart] = raw.split("---SECTION_B---");

    try {
        const parsed = JSON.parse(jsonPart.trim());
        parsed.soc_report = socPart?.trim() ?? "";
        return parsed as AgentOutput;
    } catch (error) {
        console.error("Failed to parse Agent Output:", raw);
        throw new Error("Invalid response format from LLM");
    }
}