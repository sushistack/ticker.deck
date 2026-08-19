import path from "node:path";

export function resolveStaticDir(
  compiledDirectory: string,
  configured = process.env.STATIC_DIR,
): string {
  return configured ?? path.resolve(compiledDirectory, "../../dist");
}

export function parsePort(value = process.env.PORT): number {
  const port = Number(value ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("PORT must be an integer between 1 and 65535");
  return port;
}
