import { DEFAULT_SETTINGS } from "../config";
import type { AppSettings } from "../types/market";

const KEY = "tickerdeck.settings";
export function mergeSettings(value?: Partial<AppSettings>): AppSettings {
  const validInstrument = (item: unknown) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.symbol === "string" &&
      candidate.symbol.length > 0 &&
      typeof candidate.label === "string" &&
      candidate.label.length > 0 &&
      (candidate.type === "crypto" || candidate.type === "stock")
    );
  };
  const matchesCatalog =
    Array.isArray(value?.instruments) &&
    value.instruments.length === DEFAULT_SETTINGS.instruments.length &&
    value.instruments.every((item, index) => {
      if (!validInstrument(item)) return false;
      const expected = DEFAULT_SETTINGS.instruments[index];
      return item.symbol === expected.symbol && item.type === expected.type;
    });
  const instruments =
    matchesCatalog && value?.instruments
      ? value.instruments
      : DEFAULT_SETTINGS.instruments;
  const range = value?.range === "1M" ? "1M" : "1D";
  const quoteRefreshSeconds = [5, 10, 30].includes(
    value?.quoteRefreshSeconds ?? 0,
  )
    ? value!.quoteRefreshSeconds!
    : DEFAULT_SETTINGS.quoteRefreshSeconds;
  return {
    instruments,
    range,
    quoteRefreshSeconds,
  };
}
export async function loadSettings(): Promise<AppSettings> {
  try {
    return mergeSettings(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export async function saveSettings(settings: AppSettings): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
