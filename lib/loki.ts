import { lokiClient } from "../config/index";

const LOKI_URL = process.env.LOKI_URL!;

export async function pushLogs(streams: any[]) {
    if (!streams || !Array.isArray(streams))
        throw new Error("streams array is required");

    try {
        await lokiClient.post(`/loki/api/v1/push`, { streams });
    } catch (err: any) {
        console.error("Failed to push logs:", err.message);
        throw err;
    }
}

export async function fetchLogs(
    domain: "http" | "infra" | "auth",
    from: number,
    to: number
): Promise<string[]> {
    const servicePattern: Record<string, string> = {
        http: `{service=~"api-gateway.*"}`,
        infra: `{service=~"payment-service|data-processor|order-service|search-service|notification-service|user-service|inventory-service"}`,
        auth: `{service=~"auth-service.*"}`,
    };

    const params = {
        query: servicePattern[domain],
        start: String(from),
        end: String(to),
        limit: 5000,
        direction: "FORWARD",
    };

    try {
        const { data } = await lokiClient.get("/loki/api/v1/query_range", { params });

        const lines: string[] = [];
        for (const stream of data?.data?.result ?? []) {
            for (const [, line] of stream.values) lines.push(line);
        }
        return lines;

    } catch (err: any) {
        console.error(`[LOKI] fetchLogs(${domain}) failed:`, err?.response?.data ?? err.message);
        return [];
    }
}