export function priceDecimals(price: number): number {
  if (price >= 10_000) return 0;
  if (price >= 100) return 2;
  if (price >= 1) return 2;
  if (price >= 0.1) return 5;
  return 6;
}
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: priceDecimals(price),
    maximumFractionDigits: priceDecimals(price),
  }).format(price);
}
export function formatSigned(value: number, suffix = ""): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}${suffix}`;
}
export function formatTime(timestamp?: number): string {
  return timestamp
    ? new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(timestamp * 1000))
    : "--:--:--";
}
