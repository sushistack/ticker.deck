import type { AppSettings } from "./types/market";

export const DEFAULT_SETTINGS: AppSettings = {
  instruments: [
    { symbol: "BTC-USD", label: "BTC", type: "crypto" },
    { symbol: "ETH-USD", label: "ETH", type: "crypto" },
    { symbol: "SOL-USD", label: "SOL", type: "crypto" },
    { symbol: "XRP-USD", label: "XRP", type: "crypto" },
    { symbol: "DOGE-USD", label: "DOGE", type: "crypto" },
    { symbol: "BNB-USD", label: "BNB", type: "crypto" },
    { symbol: "ADA-USD", label: "ADA", type: "crypto" },
    { symbol: "LINK-USD", label: "LINK", type: "crypto" },
    { symbol: "AVAX-USD", label: "AVAX", type: "crypto" },
    { symbol: "NVDA", label: "NVDA", type: "stock" },
    { symbol: "QQQ", label: "QQQ", type: "stock" },
  ],
  range: "1D",
  launchAtLogin: false,
  fullscreen: false,
  quoteRefreshSeconds: 5,
};
export const CHART_REFRESH_MS = { "1D": 60_000, "1M": 600_000 } as const;
export const RANGE_ROTATION_MS = 5_000;
