import { invoke } from "@tauri-apps/api/core";
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
const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
    QQQ: 568.74,
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
export class TauriMarketDataProvider implements MarketDataProvider {
  getQuotes(symbols: string[]) {
    return invoke<MarketSnapshot[]>("get_quotes", { symbols });
  }
  getCharts(symbols: string[], range: ChartRange) {
    return invoke<MarketSnapshot[]>("get_charts", { symbols, range });
  }
}
export function createMarketDataProvider(): MarketDataProvider {
  return import.meta.env.VITE_MOCK_DATA === "true" || !isTauri()
    ? new MockMarketDataProvider()
    : new TauriMarketDataProvider();
}

export function isDemoMarketData(): boolean {
  return import.meta.env.VITE_MOCK_DATA === "true" || !isTauri();
}
