export type ChartRange = "1D" | "1M";

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export interface ChartPoint {
  timestamp: number;
  price: number;
}

export interface MarketSnapshot {
  symbol: string;
  quote?: Quote;
  chart: ChartPoint[];
  stale: boolean;
  error?: string;
}

export interface MarketProvider {
  getQuote(symbol: string): Promise<Quote>;
  getChart(symbol: string, range: ChartRange): Promise<ChartPoint[]>;
}

export interface MarketReader {
  quotes(symbols: string[]): Promise<MarketSnapshot[]>;
  charts(symbols: string[], range: ChartRange): Promise<MarketSnapshot[]>;
}
