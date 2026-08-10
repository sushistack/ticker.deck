import { invoke } from "@tauri-apps/api/core";
import { disable, enable } from "@tauri-apps/plugin-autostart";
import { DEFAULT_SETTINGS } from "../config";
import type { AppSettings, MonitorPreference } from "../types/market";

const KEY = "tickerdeck.settings";
const isTauri = () => "__TAURI_INTERNALS__" in window;
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
  const instruments =
    Array.isArray(value?.instruments) &&
    value.instruments.length > 0 &&
    value.instruments.length <= 7 &&
    value.instruments.every(validInstrument)
      ? value.instruments
      : DEFAULT_SETTINGS.instruments;
  const range = value?.range === "1M" ? "1M" : "1D";
  const quoteRefreshSeconds = [5, 10, 30].includes(
    value?.quoteRefreshSeconds ?? 0,
  )
    ? value!.quoteRefreshSeconds!
    : DEFAULT_SETTINGS.quoteRefreshSeconds;
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    instruments,
    range,
    quoteRefreshSeconds,
  };
}
export async function loadSettings(): Promise<AppSettings> {
  if (isTauri())
    return mergeSettings(await invoke<Partial<AppSettings>>("load_settings"));
  try {
    return mergeSettings(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export async function saveSettings(settings: AppSettings): Promise<void> {
  if (isTauri()) await invoke("save_settings", { settings });
  else localStorage.setItem(KEY, JSON.stringify(settings));
}
export async function setAutostart(enabled: boolean) {
  if (!isTauri()) return;
  await (enabled ? enable() : disable());
}
export async function listMonitors(): Promise<MonitorPreference[]> {
  return isTauri() ? invoke("list_monitors") : [];
}
export async function moveToMonitor(
  monitor?: MonitorPreference,
  fullscreen = false,
) {
  if (isTauri())
    await invoke("move_to_monitor", { preference: monitor, fullscreen });
}
