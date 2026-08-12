import { memo } from "react";
import type { ChartRange, Instrument, MarketSnapshot } from "../types/market";
import { formatPrice, formatSigned } from "../utils/format";
import { Sparkline } from "./Sparkline";
export const MarketCard = memo(function MarketCard({
  instrument,
  snapshot,
  range,
}: {
  instrument: Instrument;
  snapshot?: MarketSnapshot;
  range: ChartRange;
}) {
  const quote = snapshot?.quote;
  const chart = snapshot?.chart ?? [];
  const up = quote
    ? quote.change >= 0
    : chart.length > 1
      ? chart.at(-1)!.price >= chart[0].price
      : true;
  const direction = up ? "up" : "down";
  return (
    <article
      className={`market-card ${direction}`}
      aria-label={`${instrument.label} 시장 카드`}
    >
      <div className="card-top">
        <span className="symbol">{instrument.label}</span>
        <span className="asset-type">
          {/* ponytail: FX from symbol suffix, not a third InstrumentType */}
          {instrument.symbol.endsWith("=X")
            ? "FX"
            : instrument.type === "crypto"
              ? "USDT"
              : "US"}
        </span>
        {snapshot?.stale && (
          <span className="stale" title={snapshot.error}>
            STALE
          </span>
        )}
        <span className="range-badge">{range}</span>
      </div>
      <div className="price">{quote ? formatPrice(quote.price) : "—"}</div>
      <div className="change">
        {quote ? (
          <>
            <span aria-hidden="true">{up ? "▲" : "▼"}</span>{" "}
            {formatSigned(quote.change)}{" "}
            <strong>{formatSigned(quote.changePercent, "%")}</strong>
          </>
        ) : (
          "—"
        )}
      </div>
      <Sparkline points={snapshot?.chart ?? []} direction={direction} />
    </article>
  );
});
