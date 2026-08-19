import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { MarketService } from "./marketService.js";
import { HybridProvider } from "./providers.js";
import { parsePort, resolveStaticDir } from "./runtime.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const staticDir = resolveStaticDir(directory);
const port = parsePort();
const service = new MarketService(new HybridProvider());
const server = createApp(service, staticDir).listen(port, "0.0.0.0", () => {
  console.log(`TickerDeck listening on :${port}`);
});

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
