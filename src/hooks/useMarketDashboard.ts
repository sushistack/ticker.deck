import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHART_REFRESH_MS } from "../config";
import { createMarketDataProvider } from "../services/marketData";
import type { ChartRange, Instrument, MarketSnapshot } from "../types/market";

export const mergeSnapshots = (
  current: Record<string, MarketSnapshot>,
  incoming: MarketSnapshot[],
) =>
  incoming.reduce((next, item) => {
    const previous = next[item.symbol];
    return {
      ...next,
      [item.symbol]: {
        ...previous,
        ...item,
        quote: item.quote ?? previous?.quote,
        chart: item.chart.length ? item.chart : (previous?.chart ?? []),
        error: item.error,
      },
    };
  }, current);

export const nextRange = (range: ChartRange): ChartRange =>
  range === "1D" ? "1M" : "1D";

export const markSnapshotsStale = (
  current: Record<string, MarketSnapshot>,
  symbols: string[],
  error = "연결 지연",
) =>
  Object.fromEntries(
    symbols.map((symbol) => [
      symbol,
      {
        ...current[symbol],
        symbol,
        chart: current[symbol]?.chart ?? [],
        stale: true,
        error,
      },
    ]),
  );

export function useMarketDashboard(
  instruments: Instrument[],
  range: ChartRange,
  quoteSeconds: number,
) {
  const quoteMs = Math.max(5, quoteSeconds) * 1000;
  const provider = useMemo(createMarketDataProvider, []);
  const [quotes, setQuotes] = useState<Record<string, MarketSnapshot>>({});
  const [charts, setCharts] = useState<
    Record<ChartRange, Record<string, MarketSnapshot>>
  >({ "1D": {}, "1M": {} });
  const [lastUpdated, setLastUpdated] = useState<number>();
  const mounted = useRef(true);
  const quoteRequest = useRef(0);
  const chartRequest = useRef<Record<ChartRange, number>>({ "1D": 0, "1M": 0 });
  const quotePending = useRef<Promise<void> | null>(null);
  const chartPending = useRef<Record<ChartRange, Promise<void> | null>>({
    "1D": null,
    "1M": null,
  });
  const symbols = useMemo(
    () => instruments.map((item) => item.symbol),
    [instruments],
  );
  const refreshQuotes = useCallback((): Promise<void> => {
    if (quotePending.current) return quotePending.current;
    const request = ++quoteRequest.current;
    const pending = (async () => {
      try {
        const data = await provider.getQuotes(symbols);
        if (mounted.current && request === quoteRequest.current) {
          setQuotes((value) => mergeSnapshots(value, data));
          if (data.some((item) => !item.stale))
            setLastUpdated(Date.now() / 1000);
        }
      } catch {
        if (mounted.current && request === quoteRequest.current)
          setQuotes((value) => markSnapshotsStale(value, symbols));
      }
    })();
    quotePending.current = pending;
    const cleanup = () => {
      if (quotePending.current === pending) quotePending.current = null;
    };
    void pending.then(cleanup, cleanup);
    return pending;
  }, [provider, symbols]);
  const refreshCharts = useCallback((): Promise<void> => {
    const existing = chartPending.current[range];
    if (existing) return existing;
    const request = ++chartRequest.current[range];
    const pending = (async () => {
      try {
        const data = await provider.getCharts(symbols, range);
        if (mounted.current && request === chartRequest.current[range])
          setCharts((value) => ({
            ...value,
            [range]: mergeSnapshots(value[range], data),
          }));
      } catch {
        if (mounted.current && request === chartRequest.current[range])
          setCharts((value) => ({
            ...value,
            [range]: markSnapshotsStale(value[range], symbols),
          }));
      }
    })();
    chartPending.current[range] = pending;
    const cleanup = () => {
      if (chartPending.current[range] === pending)
        chartPending.current[range] = null;
    };
    void pending.then(cleanup, cleanup);
    return pending;
  }, [provider, range, symbols]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    void refreshQuotes();
    const timer = window.setInterval(refreshQuotes, quoteMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [quoteMs, refreshQuotes]);
  useEffect(() => {
    void refreshCharts();
    const timer = window.setInterval(refreshCharts, CHART_REFRESH_MS[range]);
    return () => {
      window.clearInterval(timer);
    };
  }, [range, refreshCharts]);
  const snapshots = useMemo(
    () =>
      Object.fromEntries(
        symbols.map((symbol) => {
          const quote = quotes[symbol];
          const chart = charts[range][symbol];
          return [
            symbol,
            {
              symbol,
              quote: quote?.quote,
              chart: chart?.chart ?? [],
              stale: Boolean(!quote || !chart || quote.stale || chart.stale),
              error: quote?.error ?? chart?.error,
            } satisfies MarketSnapshot,
          ];
        }),
      ),
    [charts, quotes, range, symbols],
  );
  return {
    snapshots,
    lastUpdated,
    refresh: async () => {
      await Promise.all([refreshQuotes(), refreshCharts()]);
    },
  };
}
