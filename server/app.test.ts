// @vitest-environment node
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import type { MarketReader } from "./types.js";

function reader(): MarketReader {
  return {
    quotes: vi.fn(async (symbols) =>
      symbols.map((symbol) => ({ symbol, chart: [], stale: false })),
    ),
    charts: vi.fn(async (symbols) =>
      symbols.map((symbol) => ({ symbol, chart: [], stale: false })),
    ),
  };
}

describe("HTTP API", () => {
  it("serves health and validated quote requests", async () => {
    const service = reader();
    await request(createApp(service)).get("/healthz").expect(200);
    const response = await request(createApp(service))
      .get("/api/quotes")
      .query({ symbols: "QQQ,BTC-USD" })
      .expect(200);
    expect(response.body.map(({ symbol }: { symbol: string }) => symbol)).toEqual(
      ["QQQ", "BTC-USD"],
    );
  });

  it("rejects unknown symbols and ranges without calling the service", async () => {
    const service = reader();
    await request(createApp(service))
      .get("/api/quotes")
      .query({ symbols: "NOT-ALLOWED" })
      .expect(400, { error: "unsupported symbol: NOT-ALLOWED" });
    await request(createApp(service))
      .get("/api/charts")
      .query({ symbols: "QQQ", range: "1Y" })
      .expect(400, { error: "range must be 1D or 1M" });
    expect(service.quotes).not.toHaveBeenCalled();
    expect(service.charts).not.toHaveBeenCalled();
  });

  it("rejects duplicate and oversized symbol lists", async () => {
    const service = reader();
    await request(createApp(service))
      .get("/api/quotes")
      .query({ symbols: "QQQ,QQQ" })
      .expect(400, { error: "symbols must be unique" });
    const oversized = Array.from({ length: 14 }, (_, index) => `S${index}`).join(
      ",",
    );
    await request(createApp(service))
      .get("/api/quotes")
      .query({ symbols: oversized })
      .expect(400, { error: "symbols must contain 1-13 values" });
    expect(service.quotes).not.toHaveBeenCalled();
  });

  it("returns a generic 500 for unexpected service failures", async () => {
    const service = reader();
    vi.mocked(service.quotes).mockRejectedValueOnce(
      new Error("internal path /secret"),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await request(createApp(service))
      .get("/api/quotes")
      .query({ symbols: "QQQ" })
      .expect(500, { error: "internal server error" });
    consoleError.mockRestore();
  });

  it("does not report ready when configured static assets are absent", async () => {
    await request(createApp(reader(), "/definitely/missing/tickerdeck"))
      .get("/readyz")
      .expect(503, { status: "not ready" });
  });
});
