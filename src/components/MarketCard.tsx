import { memo } from "react";
import type { Instrument, MarketSnapshot } from "../types/market";
import { formatPrice, formatSigned } from "../utils/format";
import { Sparkline } from "./Sparkline";
export const MarketCard = memo(function MarketCard({
  instrument,
  snapshot,
}: {
  instrument: Instrument;
  snapshot?: MarketSnapshot;
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
          {instrument.type === "crypto" ? "CRYPTO" : "US"}
        </span>
        {snapshot?.stale && (
          <span className="stale" title={snapshot.error}>
            STALE
          </span>
        )}
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
