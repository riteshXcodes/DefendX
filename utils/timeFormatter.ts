type TimeFormat = "iso" | "locale";

export function convertBigIntToTime(
    value: bigint | number | null | undefined,
    format: TimeFormat = "iso"
) {
    if (!value) return null;

    const date = new Date(Number(value));

    if (format === "locale") {
        return date.toLocaleString(); // UI friendly
    }

    return date.toISOString(); // API standard
}