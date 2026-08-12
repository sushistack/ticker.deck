import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../config";
import { mergeSettings } from "./settings";
describe("settings", () => {
  it("fills defaults and preserves serialized values", () => {
    const saved = JSON.parse(
      JSON.stringify({ range: "1M", launchAtLogin: true }),
    );
    const result = mergeSettings(saved);
    expect(result.range).toBe("1M");
    expect(result.launchAtLogin).toBe(true);
    expect(result.instruments).toEqual(DEFAULT_SETTINGS.instruments);
  });
  it("rejects an empty instrument list", () =>
    expect(mergeSettings({ instruments: [] }).instruments).toHaveLength(11));
  it("migrates the legacy seven-card wall to the current defaults", () => {
    const legacy = DEFAULT_SETTINGS.instruments.slice(0, 5).concat([
      { symbol: "NVDA", label: "NVDA", type: "stock" },
      { symbol: "QQQ", label: "QQQ", type: "stock" },
    ]);
    const result = mergeSettings({ instruments: legacy, launchAtLogin: true });
    expect(result.instruments).toEqual(DEFAULT_SETTINGS.instruments);
    expect(result.launchAtLogin).toBe(true);
  });
  it("sanitizes corrupted range and refresh values", () => {
    const result = mergeSettings({
      range: "bad" as "1D",
      quoteRefreshSeconds: 0,
    });
    expect(result.range).toBe("1D");
    expect(result.quoteRefreshSeconds).toBe(5);
  });
  it("rejects malformed instruments from browser storage", () => {
    const result = mergeSettings({
      instruments: [{ symbol: "", label: "", type: "stock" }],
    });
    expect(result.instruments).toEqual(DEFAULT_SETTINGS.instruments);
  });
});
