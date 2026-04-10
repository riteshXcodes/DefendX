import { convertBigIntToTime } from "./timeFormatter";

export function formatJobsBatch(jobs: any[], format: "iso" | "locale" = "iso") {
    return jobs.map((job) => ({
        ...job,
        windowFrom: convertBigIntToTime(job.windowFrom, format),
        windowTo: convertBigIntToTime(job.windowTo, format),
    }));
}