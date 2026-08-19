import { UPSTREAM_TIMEOUT_MS } from "./config.js";
import type {
  ChartPoint,
  ChartRange,
  MarketProvider,
  Quote,
} from "./types.js";

type Fetcher = typeof fetch;

const BINANCE_PAIRS: Record<string, string> = {
  "BTC-USD": "BTCUSDT",
  "ETH-USD": "ETHUSDT",
  "SOL-USD": "SOLUSDT",
  "XRP-USD": "XRPUSDT",
  "DOGE-USD": "DOGEUSDT",
  "ZEC-USD": "ZECUSDT",
};

async function fetchJson(fetcher: Fetcher, url: URL): Promise<unknown> {
  const response = await fetcher(url, {
    headers: { "user-agent": "TickerDeck/0.1" },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
  return response.json();
}

function finiteNumber(value: unknown, label: string): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  )
    throw new Error(`invalid ${label}`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`invalid ${label}`);
  return number;
}

export class BinanceProvider implements MarketProvider {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly baseUrl = "https://api.binance.com",
  ) {}

  async getQuote(symbol: string): Promise<Quote> {
    const pair = BINANCE_PAIRS[symbol];
    if (!pair) throw new Error(`unsupported Binance symbol: ${symbol}`);
    const url = new URL("/api/v3/ticker/24hr", this.baseUrl);
    url.searchParams.set("symbol", pair);
    const value = (await fetchJson(this.fetcher, url)) as Record<
      string,
      unknown
    >;
    const price = finiteNumber(value.lastPrice, "Binance price");
    const change = finiteNumber(value.priceChange, "Binance change");
    const previousClose = price - change;
    if (previousClose <= 0) throw new Error("invalid Binance previous close");
    return {
      symbol,
      price,
      previousClose,
      change,
      changePercent: finiteNumber(
        value.priceChangePercent,
        "Binance change percent",
      ),
      timestamp: Math.floor(finiteNumber(value.closeTime, "Binance time") / 1000),
    };
  }

  async getChart(symbol: string, range: ChartRange): Promise<ChartPoint[]> {
    const pair = BINANCE_PAIRS[symbol];
    if (!pair) throw new Error(`unsupported Binance symbol: ${symbol}`);
    const url = new URL("/api/v3/klines", this.baseUrl);
    url.searchParams.set("symbol", pair);
    url.searchParams.set("interval", range === "1D" ? "5m" : "1h");
    url.searchParams.set("limit", range === "1D" ? "288" : "720");
    const rows = (await fetchJson(this.fetcher, url)) as unknown[][];
    const points = rows.flatMap((row) => {
      try {
        return [
          {
            timestamp: Math.floor(finiteNumber(row[0], "candle time") / 1000),
            price: finiteNumber(row[4], "candle close"),
          },
        ];
      } catch {
        return [];
      }
    });
    if (points.length < 2) throw new Error("insufficient Binance candles");
    return points;
  }
}

interface YahooResult {
  meta?: {
    regularMarketPrice?: number;
    regularMarketTime?: number;
    chartPreviousClose?: number;
    previousClose?: number;
  };
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
}

export class YahooProvider implements MarketProvider {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly baseUrl = "https://query2.finance.yahoo.com",
  ) {}

  private async result(
    symbol: string,
    range: string,
    interval: string,
  ): Promise<YahooResult> {
    const url = new URL(
      `/v8/finance/chart/${encodeURIComponent(symbol)}`,
      this.baseUrl,
    );
    url.searchParams.set("range", range);
    url.searchParams.set("interval", interval);
    url.searchParams.set("includePrePost", "false");
    url.searchParams.set("events", "div,splits");
    const body = (await fetchJson(this.fetcher, url)) as {
      chart?: {
        result?: YahooResult[];
        error?: { description?: string };
      };
    };
    const result = body.chart?.result?.[0];
    if (!result)
      throw new Error(body.chart?.error?.description ?? "symbol unavailable");
    return result;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const result = await this.result(symbol, "1d", "1m");
    const price = finiteNumber(result.meta?.regularMarketPrice, "Yahoo price");
    const previousClose = finiteNumber(
      result.meta?.chartPreviousClose ?? result.meta?.previousClose,
      "Yahoo previous close",
    );
    if (previousClose <= 0) throw new Error("invalid Yahoo previous close");
    const change = price - previousClose;
    return {
      symbol,
      price,
      previousClose,
      change,
      changePercent: (change / previousClose) * 100,
      timestamp: finiteNumber(result.meta?.regularMarketTime ?? 0, "Yahoo time"),
    };
  }

  async getChart(symbol: string, range: ChartRange): Promise<ChartPoint[]> {
    const result = await this.result(
      symbol,
      range === "1D" ? "1d" : "1mo",
      range === "1D" ? "5m" : "1h",
    );
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const points = timestamps.flatMap((timestamp, index) => {
      const price = closes[index];
      return Number.isFinite(timestamp) &&
        typeof price === "number" &&
        Number.isFinite(price)
        ? [{ timestamp, price }]
        : [];
    });
    if (points.length < 2) throw new Error("insufficient Yahoo candles");
    return points;
  }
}

export class HybridProvider implements MarketProvider {
  constructor(
    private readonly binance = new BinanceProvider(),
    private readonly yahoo = new YahooProvider(),
  ) {}

  private provider(symbol: string): MarketProvider {
    return symbol.endsWith("-USD") ? this.binance : this.yahoo;
  }

  getQuote(symbol: string) {
    return this.provider(symbol).getQuote(symbol);
  }

  getChart(symbol: string, range: ChartRange) {
    return this.provider(symbol).getChart(symbol, range);
  }
}
