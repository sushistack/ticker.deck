import { DEFAULT_INSTRUMENTS } from "../shared/instruments.js";

export const ALLOWED_SYMBOLS = DEFAULT_INSTRUMENTS.map(
  ({ symbol }) => symbol,
);

export const ALLOWED_SYMBOL_SET = new Set<string>(ALLOWED_SYMBOLS);
export const MAX_SYMBOLS_PER_REQUEST = ALLOWED_SYMBOLS.length;
export const UPSTREAM_TIMEOUT_MS = 8_000;
