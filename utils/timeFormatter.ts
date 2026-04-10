type TimeFormat = "iso" | "locale";

export function convertBigIntToTime(
    value: bigint | number | null | undefined,
    format: TimeFormat = "iso"
) {
    if (!value) return null;

    let num = Number(value);

    if (num > 1e18) {
        num = Math.floor(num / 1e6);
    } else if (num > 1e15) {
        num = Math.floor(num / 1e3);
    } else if (num < 1e12) {
        num = num * 1000;
    }

    const date = new Date(num);

    if (isNaN(date.getTime())) {
        console.error("Invalid timestamp:", value);
        return null;
    }

    return format === "locale"
        ? date.toLocaleString()
        : date.toISOString();
}