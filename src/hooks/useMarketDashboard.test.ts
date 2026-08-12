import { describe, expect, it } from "vitest";
import { mergeSnapshots, nextRange, pollingPolicy } from "./useMarketDashboard";
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
describe("appliance polling policy", () => {
  it("uses normal polling while the display is active", () =>
    expect(pollingPolicy(true, 5)).toEqual({
      quoteMs: 5000,
      chartEnabled: true,
    }));
  it("reduces quote polling and pauses charts overnight", () =>
    expect(pollingPolicy(false, 5)).toEqual({
      quoteMs: 900000,
      chartEnabled: false,
    }));
});
describe("automatic range rotation", () => {
  it("alternates between the two supported ranges", () => {
    expect(nextRange("1D")).toBe("1M");
    expect(nextRange("1M")).toBe("1D");
  });
});
