import type {
  ChartPoint,
  ChartRange,
  MarketProvider,
  MarketReader,
  MarketSnapshot,
  Quote,
} from "./types.js";

interface CacheEntry<T> {
  value: T;
  updatedAt: number;
}

const QUOTE_TTL_MS = 4_000;
const CHART_TTL_MS: Record<ChartRange, number> = {
  "1D": 60_000,
  "1M": 600_000,
};

export class MarketService implements MarketReader {
  private readonly quoteCache = new Map<string, CacheEntry<Quote>>();
  private readonly chartCache = new Map<string, CacheEntry<ChartPoint[]>>();
  private readonly quoteInFlight = new Map<string, Promise<Quote>>();
  private readonly chartInFlight = new Map<string, Promise<ChartPoint[]>>();

  constructor(
    private readonly provider: MarketProvider,
    private readonly now: () => number = Date.now,
  ) {}

  async quotes(symbols: string[]): Promise<MarketSnapshot[]> {
    return Promise.all(
      symbols.map(async (symbol) => {
        const cached = this.quoteCache.get(symbol);
        if (cached && isFresh(this.now(), cached.updatedAt, QUOTE_TTL_MS))
          return { symbol, quote: cached.value, chart: [], stale: false };
        try {
          const quote = await this.coalescedQuote(symbol);
          this.quoteCache.set(symbol, { value: quote, updatedAt: this.now() });
          return { symbol, quote, chart: [], stale: false };
        } catch (error) {
          return {
            symbol,
            quote: cached?.value,
            chart: [],
            stale: true,
            error: safeError(error),
          };
        }
      }),
    );
  }

  async charts(
    symbols: string[],
    range: ChartRange,
  ): Promise<MarketSnapshot[]> {
    return Promise.all(
      symbols.map(async (symbol) => {
        const key = `${symbol}:${range}`;
        const cached = this.chartCache.get(key);
        if (cached && isFresh(this.now(), cached.updatedAt, CHART_TTL_MS[range]))
          return { symbol, chart: cached.value, stale: false };
        try {
          const chart = await this.coalescedChart(key, symbol, range);
          this.chartCache.set(key, { value: chart, updatedAt: this.now() });
          return { symbol, chart, stale: false };
        } catch (error) {
          return {
            symbol,
            chart: cached?.value ?? [],
            stale: true,
            error: safeError(error),
          };
        }
      }),
    );
  }

  private coalescedQuote(symbol: string): Promise<Quote> {
    const pending = this.quoteInFlight.get(symbol);
    if (pending) return pending;
    const request = this.provider.getQuote(symbol);
    this.quoteInFlight.set(symbol, request);
    const cleanup = () => {
      if (this.quoteInFlight.get(symbol) === request)
        this.quoteInFlight.delete(symbol);
    };
    void request.then(cleanup, cleanup);
    return request;
  }

  private coalescedChart(
    key: string,
    symbol: string,
    range: ChartRange,
  ): Promise<ChartPoint[]> {
    const pending = this.chartInFlight.get(key);
    if (pending) return pending;
    const request = this.provider.getChart(symbol, range);
    this.chartInFlight.set(key, request);
    const cleanup = () => {
      if (this.chartInFlight.get(key) === request)
        this.chartInFlight.delete(key);
    };
    void request.then(cleanup, cleanup);
    return request;
  }
}

function isFresh(now: number, updatedAt: number, ttl: number): boolean {
  const age = now - updatedAt;
  return age >= 0 && age < ttl;
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 160) : "upstream error";
}
