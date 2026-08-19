import express, { type Response } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import type { MarketReader } from "./types.js";
import {
  parseRange,
  parseSymbols,
  ValidationError,
} from "./validation.js";

export function createApp(service: MarketReader, staticDir?: string) {
  const app = express();
  app.disable("x-powered-by");
  const indexPath = staticDir ? path.join(staticDir, "index.html") : undefined;

  app.get("/healthz", (_request, response) => response.json({ status: "ok" }));
  app.get("/readyz", (_request, response) =>
    !indexPath || existsSync(indexPath)
      ? response.json({ status: "ready" })
      : response.status(503).json({ status: "not ready" }),
  );

  app.get("/api/quotes", async (request, response) => {
    await marketResponse(response, () =>
      service.quotes(parseSymbols(request.query.symbols)),
    );
  });
  app.get("/api/charts", async (request, response) => {
    await marketResponse(response, () =>
      service.charts(
        parseSymbols(request.query.symbols),
        parseRange(request.query.range),
      ),
    );
  });

  if (staticDir) {
    app.use(express.static(staticDir, { index: false, maxAge: "1h" }));
    app.use((request, response, next) => {
      if (request.method !== "GET" || request.path.startsWith("/api/"))
        return next();
      return response.sendFile(indexPath!);
    });
  }

  app.use((_request, response) =>
    response.status(404).json({ error: "not found" }),
  );
  return app;
}

async function marketResponse(
  response: Response,
  operation: () => Promise<unknown>,
) {
  response.setHeader("cache-control", "no-store");
  try {
    response.json(await operation());
  } catch (error) {
    if (error instanceof ValidationError)
      return response.status(400).json({ error: error.message });
    console.error("market request failed", error);
    return response.status(500).json({ error: "internal server error" });
  }
}
