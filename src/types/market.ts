export type ChartRange = "1D" | "1M";
export type InstrumentType = "crypto" | "stock";
export interface Instrument {
  symbol: string;
  label: string;
  type: InstrumentType;
}
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
export interface MonitorPreference {
  name?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleFactor: number;
}
export interface AppSettings {
  instruments: Instrument[];
  range: ChartRange;
  targetMonitor?: MonitorPreference;
  launchAtLogin: boolean;
  fullscreen: boolean;
  quoteRefreshSeconds: number;
}
export type DisplayPower =
  | "unmanaged"
  | "prewarming"
  | "on"
  | "off"
  | "unsupported"
  | "error";
export interface ApplianceStatus {
  enabled: boolean;
  displayActive: boolean;
  displayPower: DisplayPower;
  nextTransition?: string;
  detail?: string;
}
