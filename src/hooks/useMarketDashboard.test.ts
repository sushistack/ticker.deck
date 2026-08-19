import { describe, expect, it } from "vitest";
import {
  markSnapshotsStale,
  mergeSnapshots,
  nextRange,
} from "./useMarketDashboard";
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
        stale: true,
        error: "old failure",
      },
    };
    const merged = mergeSnapshots(current, [
      { symbol: "QQQ", chart: [], stale: true, error: "rate limited" },
    ]);
    expect(merged.QQQ.quote).toEqual(quote);
    expect(merged.QQQ.chart).toHaveLength(1);
    expect(merged.QQQ.stale).toBe(true);
  });

  it("clears an old provider error after a successful update", () => {
    const current = {
      QQQ: {
        symbol: "QQQ",
        chart: [],
        stale: true,
        error: "offline",
      },
    };
    const merged = mergeSnapshots(current, [
      { symbol: "QQQ", chart: [], stale: false },
    ]);
    expect(merged.QQQ.error).toBeUndefined();
  });
  it("marks a failed chart request stale without dropping cached points", () => {
    const current = {
      QQQ: {
        symbol: "QQQ",
        chart: [{ timestamp: 1, price: 10 }],
        stale: false,
      },
    };
    const stale = markSnapshotsStale(current, ["QQQ"]);
    expect(stale.QQQ).toMatchObject({
      chart: [{ timestamp: 1, price: 10 }],
      stale: true,
      error: "연결 지연",
    });
  });
});
describe("automatic range rotation", () => {
  it("alternates between the two supported ranges", () => {
    expect(nextRange("1D")).toBe("1M");
    expect(nextRange("1M")).toBe("1D");
  });
});
