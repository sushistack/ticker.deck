import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHART_REFRESH_MS } from "../config";
import { createMarketDataProvider } from "../services/marketData";
import type { ChartRange, Instrument, MarketSnapshot } from "../types/market";

export function pollingPolicy(displayActive: boolean, quoteSeconds: number) {
  return {
    quoteMs: displayActive ? Math.max(5, quoteSeconds) * 1000 : 15 * 60 * 1000,
    chartEnabled: displayActive,
  };
}

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
      },
    };
  }, current);
export function useMarketDashboard(
  instruments: Instrument[],
  range: ChartRange,
  quoteSeconds: number,
  displayActive = true,
) {
  const policy = pollingPolicy(displayActive, quoteSeconds);
  const provider = useMemo(createMarketDataProvider, []);
  const [snapshots, setSnapshots] = useState<Record<string, MarketSnapshot>>(
    {},
  );
  const [lastUpdated, setLastUpdated] = useState<number>();
  const mounted = useRef(true);
  const quoteRequest = useRef(0);
  const chartRequest = useRef(0);
  const symbols = useMemo(
    () => instruments.map((item) => item.symbol),
    [instruments],
  );
  const refreshQuotes = useCallback(async () => {
    const request = ++quoteRequest.current;
    try {
      const data = await provider.getQuotes(symbols);
      if (mounted.current && request === quoteRequest.current) {
        setSnapshots((value) => mergeSnapshots(value, data));
        if (data.some((item) => !item.stale)) setLastUpdated(Date.now() / 1000);
      }
    } catch {
      if (mounted.current && request === quoteRequest.current)
        setSnapshots((value) =>
          Object.fromEntries(
            symbols.map((symbol) => [
              symbol,
              {
                ...value[symbol],
                symbol,
                chart: value[symbol]?.chart ?? [],
                stale: true,
                error: "연결 지연",
              },
            ]),
          ),
        );
    }
  }, [provider, symbols]);
  const refreshCharts = useCallback(async () => {
    const request = ++chartRequest.current;
    try {
      const data = await provider.getCharts(symbols, range);
      if (mounted.current && request === chartRequest.current)
        setSnapshots((value) => mergeSnapshots(value, data));
    } catch {
      /* retain cached chart */
    }
  }, [provider, range, symbols]);
  useEffect(() => {
    mounted.current = true;
    if (displayActive) void refreshQuotes();
    const timer = window.setInterval(refreshQuotes, policy.quoteMs);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [displayActive, policy.quoteMs, refreshQuotes]);
  useEffect(() => {
    mounted.current = true;
    if (!policy.chartEnabled)
      return () => {
        mounted.current = false;
      };
    void refreshCharts();
    const timer = window.setInterval(refreshCharts, CHART_REFRESH_MS[range]);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [policy.chartEnabled, range, refreshCharts]);
  return {
    snapshots,
    lastUpdated,
    refresh: async () => {
      await Promise.all([refreshQuotes(), refreshCharts()]);
    },
  };
}
