import { commanderClient, OPENROUTER_MODEL } from "../config/index";

export interface AgentFinding {
    finding_id: string;
    domain: "identity" | "http" | "infrastructure";
    classification: string;
    severity: "low" | "medium" | "high" | "critical";
    confidence: number;
    context: { service: string; app: string; environment: string };
    offender: { type: "ip" | "user" | "token" | "service"; value: string };
    metrics: {
        event_count: number;
        unique_targets: number;
        success_count: number;
        failure_count: number;
    };
    time_window: { from: number; to: number };
    evidence_samples: string[];
    summary: string;
    recommended_action: string;
}

export interface AgentOutput {
    execution_id: string;
    analyzed_time_window: { from: number; to: number };
    metadata: {
        commander_version: string;
        analysis_type: string;
        log_sources: string[];
        total_logs_analyzed: number;
    };
    findings: AgentFinding[];
    soc_report: string;
}

const SYSTEM_PROMPT = `You are DefendX Commander, an autonomous security analyst. 
Your task is to analyze provided raw log data, correlate events, and generate actionable security findings based on strict detection standards.

### DETECTION STANDARDS & THRESHOLDS

1. IDENTITY DOMAIN:
   - Brute Force: 5+ failed auth from same IP/5min. (11-20=HIGH, 20+=CRITICAL).
   - Credential Stuffing: 5+ different users, same IP, failed auth/10min. (Always HIGH+).
   - Session Hijacking: Same session ID seen from 2+ different IPs. (Always HIGH).

2. HTTP DOMAIN:
   - Endpoint Scanning: 5+ distinct 404/403 errors from same IP/5min.
   - SQLi/Path Traversal: Any string containing "SELECT", "UNION", or "../". (Always HIGH).
   - Resource Exhaustion: 500+ req/min from a single IP. (CRITICAL if service crashes).

3. INFRASTRUCTURE DOMAIN:
   - Service Crash: Any "restart" or "panic" within 5min of errors. (Always HIGH).
   - Resource Stress: CPU >90% or Memory >95% for 3+ minutes.

### OUTPUT FORMAT
Respond with EXACTLY two sections separated by the delimiter ---SECTION_B---:

SECTION A: A JSON object. No markdown fences.
{
  "execution_id": "...",
  "analyzed_time_window": { "from": <ms>, "to": <ms> },
  "metadata": { "commander_version": "2.0", "analysis_type": "batch", "log_sources": [], "total_logs_analyzed": 0 },
  "findings": [
    {
      "finding_id": "exec-id-001",
      "domain": "identity|http|infrastructure",
      "classification": "...",
      "severity": "low|medium|high|critical",
      "confidence": 0.0-1.0,
      "context": { "service": "...", "app": "...", "environment": "..." },
      "offender": { "type": "ip|user|token|service", "value": "..." },
      "metrics": { "event_count": 0, "unique_targets": 0, "success_count": 0, "failure_count": 0 },
      "time_window": { "from": <ms>, "to": <ms> },
      "evidence_samples": ["actual log lines max 100 chars"],
      "summary": "...",
      "recommended_action": "..."
    }
  ]
}

---SECTION_B---

SECTION B: A professional SOC report (300-500 words).
Structure: 
### Executive Summary
### Timeline and Attack Pattern
### Technical Details
### Risk Assessment
### Recommendations`;

export async function runAnalysis(
    logs: Record<string, string[]>,
    windowFrom: number,
    windowTo: number,
    environment: string = "production"
): Promise<AgentOutput> {
    // 1. Prepare Log Text
    const logText = Object.entries(logs)
        .map(([domain, lines]) => `### ${domain.toUpperCase()} DOMAIN LOGS ###\n${lines.join("\n")}`)
        .join("\n\n");

    const executionId = `exec-${Date.now()}`;

    // 2. Build the prompt with context
    const userMessage = `
EXECUTION METADATA:
Execution ID: ${executionId}
Analysis Window: ${windowFrom} to ${windowTo} (epoch ms)
Environment: ${environment}

RAW LOG DATA:
${logText || "No logs available for this period."}

INSTRUCTIONS:
1. Count total logs analyzed across all domains.
2. Apply detection thresholds exactly.
3. If no incidents found, return "findings": [].
4. Do not hallucinate IPs; use values found in the text.`;

    const { data } = await commanderClient.post("/chat/completions", {
        model: OPENROUTER_MODEL,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
        ],
        temperature: 0, // Ensure deterministic analysis
    });

    const raw: string = data.choices[0].message.content;
    const parts = raw.split("---SECTION_B---");

    if (parts.length < 2) {
        throw new Error("LLM failed to provide the required delimiter between JSON and Report.");
    }

    try {
        const parsed = JSON.parse(parts[0].trim());
        parsed.soc_report = parts[1].trim();
        return parsed as AgentOutput;
    } catch (error) {
        console.error("Failed to parse Agent Output. Raw response:", raw);
        throw new Error("Invalid JSON format from LLM");
    }
}