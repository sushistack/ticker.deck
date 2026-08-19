import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpMarketDataProvider, isDemoMarketData } from "./marketData";

describe("HTTP market provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests live data from the same-origin API", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify([{ symbol: "QQQ", chart: [], stale: false }])),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await new HttpMarketDataProvider().getQuotes(["QQQ"]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/quotes?symbols=QQQ",
      expect.objectContaining({
        headers: { accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result[0].symbol).toBe("QQQ");
  });

  it("uses live mode unless mock mode is explicitly built", () => {
    expect(isDemoMarketData()).toBe(false);
  });
});
