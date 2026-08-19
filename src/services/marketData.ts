import type {
  ChartPoint,
  ChartRange,
  MarketSnapshot,
  Quote,
} from "../types/market";

export interface MarketDataProvider {
  getQuotes(symbols: string[]): Promise<MarketSnapshot[]>;
  getCharts(symbols: string[], range: ChartRange): Promise<MarketSnapshot[]>;
}
function seeded(symbol: string): number {
  return [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
function mockPrice(symbol: string): number {
  const bases: Record<string, number> = {
    "BTC-USD": 116320,
    "ETH-USD": 3820.42,
    "SOL-USD": 178.64,
    "XRP-USD": 3.1842,
    "DOGE-USD": 0.23184,
    "ZEC-USD": 493.61,
    QQQ: 568.74,
    IONQ: 42.18,
    "^IXIC": 21840.2,
    "^GSPC": 6412.5,
    ORCL: 241.63,
    LHX: 278.9,
    "KRW=X": 1382.4,
  };
  return bases[symbol] ?? 100;
}
function mockQuote(symbol: string): Quote {
  const base = mockPrice(symbol);
  const wave = Math.sin(Date.now() / 12_000 + seeded(symbol)) * base * 0.001;
  const previousClose = base * (seeded(symbol) % 2 ? 0.982 : 1.012);
  const price = base + wave;
  const change = price - previousClose;
  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent: (change / previousClose) * 100,
    timestamp: Math.floor(Date.now() / 1000),
  };
}
function mockChart(symbol: string, range: ChartRange): ChartPoint[] {
  // ponytail: mirror the production candle density (5m/1h) so mock isn't visibly coarser
  const count = range === "1D" ? 288 : 720;
  const interval = range === "1D" ? 300 : 3_600;
  const now = Math.floor(Date.now() / 1000);
  const base = mockPrice(symbol);
  return Array.from({ length: count }, (_, index) => ({
    timestamp: now - (count - index) * interval,
    price:
      base *
      (1 +
        Math.sin((index / count) * 12 + seeded(symbol)) * 0.012 +
        (index / count - 0.5) * (seeded(symbol) % 2 ? 0.02 : -0.018)),
  }));
}

export class MockMarketDataProvider implements MarketDataProvider {
  async getQuotes(symbols: string[]) {
    return symbols.map((symbol) => ({
      symbol,
      quote: mockQuote(symbol),
      chart: [],
      stale: false,
    }));
  }
  async getCharts(symbols: string[], range: ChartRange) {
    return symbols.map((symbol) => ({
      symbol,
      quote: mockQuote(symbol),
      chart: mockChart(symbol, range),
      stale: false,
    }));
  }
}
export class HttpMarketDataProvider implements MarketDataProvider {
  async getQuotes(symbols: string[]) {
    return request("/api/quotes", { symbols: symbols.join(",") });
  }
  async getCharts(symbols: string[], range: ChartRange) {
    return request("/api/charts", { symbols: symbols.join(","), range });
  }
}

async function request(path: string, params: Record<string, string>) {
  const response = await fetch(`${path}?${new URLSearchParams(params)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`market API HTTP ${response.status}`);
  return (await response.json()) as MarketSnapshot[];
}

export function createMarketDataProvider(): MarketDataProvider {
  return import.meta.env.VITE_MOCK_DATA === "true"
    ? new MockMarketDataProvider()
    : new HttpMarketDataProvider();
}

export function isDemoMarketData(): boolean {
  return import.meta.env.VITE_MOCK_DATA === "true";
}
