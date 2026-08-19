// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { MarketService } from "./marketService.js";
import type { MarketProvider } from "./types.js";

function provider(): MarketProvider {
  return {
    getQuote: vi.fn(async (symbol) => ({
      symbol,
      price: 2,
      previousClose: 1,
      change: 1,
      changePercent: 100,
      timestamp: 1,
    })),
    getChart: vi.fn(async () => [
      { timestamp: 1, price: 1 },
      { timestamp: 2, price: 2 },
    ]),
  };
}

describe("MarketService", () => {
  it("uses fresh cache entries and preserves request ordering", async () => {
    const upstream = provider();
    const service = new MarketService(upstream);
    const first = await service.quotes(["QQQ", "BTC-USD"]);
    const second = await service.quotes(["QQQ", "BTC-USD"]);
    expect(first.map(({ symbol }) => symbol)).toEqual(["QQQ", "BTC-USD"]);
    expect(second).toEqual(first);
    expect(upstream.getQuote).toHaveBeenCalledTimes(2);
  });

  it("returns the last good quote as stale after refresh failure", async () => {
    let now = 1_000;
    const upstream = provider();
    const service = new MarketService(upstream, () => now);
    await service.quotes(["QQQ"]);
    now += 5_000;
    vi.mocked(upstream.getQuote).mockRejectedValueOnce(new Error("offline"));
    const [snapshot] = await service.quotes(["QQQ"]);
    expect(snapshot.quote?.price).toBe(2);
    expect(snapshot).toMatchObject({ stale: true, error: "offline" });
  });

  it("keeps chart ranges in independent caches", async () => {
    const upstream = provider();
    const service = new MarketService(upstream);
    await service.charts(["QQQ"], "1D");
    await service.charts(["QQQ"], "1M");
    await service.charts(["QQQ"], "1D");
    expect(upstream.getChart).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent cache misses", async () => {
    const upstream = provider();
    const service = new MarketService(upstream);
    await Promise.all([
      service.quotes(["QQQ"]),
      service.quotes(["QQQ"]),
      service.charts(["QQQ"], "1D"),
      service.charts(["QQQ"], "1D"),
    ]);
    expect(upstream.getQuote).toHaveBeenCalledTimes(1);
    expect(upstream.getChart).toHaveBeenCalledTimes(1);
  });

  it("starts the TTL after a slow fetch completes", async () => {
    let now = 0;
    const upstream = provider();
    vi.mocked(upstream.getQuote).mockImplementationOnce(async (symbol) => {
      now = 5_000;
      return {
        symbol,
        price: 2,
        previousClose: 1,
        change: 1,
        changePercent: 100,
        timestamp: 1,
      };
    });
    const service = new MarketService(upstream, () => now);
    await service.quotes(["QQQ"]);
    await service.quotes(["QQQ"]);
    expect(upstream.getQuote).toHaveBeenCalledTimes(1);
  });
});
