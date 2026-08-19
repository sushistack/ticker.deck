import type { AppSettings } from "./types/market";
import { DEFAULT_INSTRUMENTS } from "../shared/instruments";

export const DEFAULT_SETTINGS: AppSettings = {
  instruments: DEFAULT_INSTRUMENTS.map((instrument) => ({ ...instrument })),
  range: "1D",
  quoteRefreshSeconds: 5,
};
export const CHART_REFRESH_MS = { "1D": 60_000, "1M": 600_000 } as const;
export const RANGE_ROTATION_MS = 5_000;
