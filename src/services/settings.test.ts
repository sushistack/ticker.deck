import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../config";
import { mergeSettings } from "./settings";
describe("settings", () => {
  it("fills defaults and preserves serialized values", () => {
    const saved = JSON.parse(
      JSON.stringify({ range: "1M", quoteRefreshSeconds: 10 }),
    );
    const result = mergeSettings(saved);
    expect(result.range).toBe("1M");
    expect(result.quoteRefreshSeconds).toBe(10);
    expect(result.instruments).toEqual(DEFAULT_SETTINGS.instruments);
  });
  it("rejects an empty instrument list", () =>
    expect(mergeSettings({ instruments: [] }).instruments).toHaveLength(13));
  it("keeps Zcash after DOGE and IONQ after QQQ", () => {
    const symbols = DEFAULT_SETTINGS.instruments.map(({ symbol }) => symbol);
    expect(symbols.indexOf("ZEC-USD")).toBe(symbols.indexOf("DOGE-USD") + 1);
    expect(symbols.indexOf("IONQ")).toBe(symbols.indexOf("QQQ") + 1);
  });
  it("migrates the legacy seven-card wall to the current defaults", () => {
    const legacy = DEFAULT_SETTINGS.instruments.slice(0, 5).concat([
      { symbol: "NVDA", label: "NVDA", type: "stock" },
      { symbol: "QQQ", label: "QQQ", type: "stock" },
    ]);
    const result = mergeSettings({ instruments: legacy });
    expect(result.instruments).toEqual(DEFAULT_SETTINGS.instruments);
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
  it("rejects unsupported, duplicate, or reordered saved symbols", () => {
    const unsupported = DEFAULT_SETTINGS.instruments.map((item) => ({ ...item }));
    unsupported[0].symbol = "UNKNOWN";
    expect(mergeSettings({ instruments: unsupported }).instruments).toEqual(
      DEFAULT_SETTINGS.instruments,
    );
    const reordered = [...DEFAULT_SETTINGS.instruments].reverse();
    expect(mergeSettings({ instruments: reordered }).instruments).toEqual(
      DEFAULT_SETTINGS.instruments,
    );
  });
});
