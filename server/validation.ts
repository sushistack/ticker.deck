import {
  ALLOWED_SYMBOL_SET,
  MAX_SYMBOLS_PER_REQUEST,
} from "./config.js";
import type { ChartRange } from "./types.js";

export class ValidationError extends Error {}

export function parseSymbols(value: unknown): string[] {
  if (typeof value !== "string") throw new ValidationError("symbols is required");
  const symbols = value
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
  if (!symbols.length || symbols.length > MAX_SYMBOLS_PER_REQUEST)
    throw new ValidationError(
      `symbols must contain 1-${MAX_SYMBOLS_PER_REQUEST} values`,
    );
  if (new Set(symbols).size !== symbols.length)
    throw new ValidationError("symbols must be unique");
  const unknown = symbols.find((symbol) => !ALLOWED_SYMBOL_SET.has(symbol));
  if (unknown) throw new ValidationError(`unsupported symbol: ${unknown}`);
  return symbols;
}

export function parseRange(value: unknown): ChartRange {
  if (value !== "1D" && value !== "1M")
    throw new ValidationError("range must be 1D or 1M");
  return value;
}
