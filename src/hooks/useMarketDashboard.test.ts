import { describe, expect, it } from "vitest";
import { mergeSnapshots } from "./useMarketDashboard";
describe("dashboard stale fallback", () => {
  it("keeps the last valid quote and chart when a partial update omits them", () => {
    const quote = {
      symbol: "QQQ",
      price: 568,
      previousClose: 567,
      change: 1,
      changePercent: 0.17,
      timestamp: 1,
    };
    const current = {
      QQQ: {
        symbol: "QQQ",
        quote,
        chart: [{ timestamp: 1, price: 567 }],
        stale: false,
      },
    };
    const merged = mergeSnapshots(current, [
      { symbol: "QQQ", chart: [], stale: true, error: "rate limited" },
    ]);
    expect(merged.QQQ.quote).toEqual(quote);
    expect(merged.QQQ.chart).toHaveLength(1);
    expect(merged.QQQ.stale).toBe(true);
  });
});
