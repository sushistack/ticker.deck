// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { BinanceProvider, HybridProvider, YahooProvider } from "./providers.js";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("market providers", () => {
  it("normalizes a Binance ticker and maps the UI symbol", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      expect(String(input)).toContain("symbol=BTCUSDT");
      return jsonResponse({
        lastPrice: "120.5",
        priceChange: "2.5",
        priceChangePercent: "2.118",
        closeTime: 1_700_000_000_000,
      });
    }) as typeof fetch;
    const quote = await new BinanceProvider(fetcher).getQuote("BTC-USD");
    expect(quote).toMatchObject({
      price: 120.5,
      previousClose: 118,
      timestamp: 1_700_000_000,
    });
  });

  it("drops missing Yahoo candles without fabricating points", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        chart: {
          result: [
            {
              timestamp: [1, 2, 3],
              indicators: { quote: [{ close: [10, null, 12] }] },
            },
          ],
        },
      }),
    ) as typeof fetch;
    const chart = await new YahooProvider(fetcher).getChart("QQQ", "1D");
    expect(chart).toEqual([
      { timestamp: 1, price: 10 },
      { timestamp: 3, price: 12 },
    ]);
  });

  it("routes crypto and stocks to separate providers", async () => {
    const binance = {
      getQuote: vi.fn(async (symbol: string) => ({
        symbol,
        price: 2,
        previousClose: 1,
        change: 1,
        changePercent: 100,
        timestamp: 1,
      })),
      getChart: vi.fn(async () => []),
    };
    const yahoo = {
      getQuote: vi.fn(async (symbol: string) => ({
        symbol,
        price: 2,
        previousClose: 1,
        change: 1,
        changePercent: 100,
        timestamp: 1,
      })),
      getChart: vi.fn(async () => []),
    };
    const provider = new HybridProvider(binance, yahoo);
    await Promise.all([
      provider.getQuote("BTC-USD"),
      provider.getQuote("QQQ"),
    ]);
    expect(binance.getQuote).toHaveBeenCalledWith("BTC-USD");
    expect(yahoo.getQuote).toHaveBeenCalledWith("QQQ");
  });

  it("rejects null numeric fields instead of coercing them to zero", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        lastPrice: null,
        priceChange: "1",
        priceChangePercent: "1",
        closeTime: 1_000,
      }),
    ) as typeof fetch;
    await expect(
      new BinanceProvider(fetcher).getQuote("BTC-USD"),
    ).rejects.toThrow("invalid Binance price");
  });
});
