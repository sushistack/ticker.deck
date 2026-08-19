import { useEffect, useState } from "react";
import type { ChartRange } from "../types/market";
import { formatTime } from "../utils/format";
import { RangeSelector } from "./RangeSelector";
export function StatusCard({
  range,
  lastUpdated,
  staleCount,
  onRange,
  onRefresh,
  onSettings,
  demo = false,
}: {
  range: ChartRange;
  lastUpdated?: number;
  staleCount: number;
  onRange: (range: ChartRange) => void;
  onRefresh: () => void;
  onSettings: () => void;
  demo?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <aside className="status-card">
      <div className="status-top">
        <span className="deck-mark">
          TICKER<span>DECK</span>
        </span>
        <div className="window-actions">
          <button
            className="icon-button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onSettings}
            aria-label="설정 열기"
          >
            ⚙
          </button>
        </div>
      </div>
      <div className="clock" aria-label="현재 시각">
        <time>{now.toLocaleTimeString("ko-KR", { hour12: false })}</time>
        <span>
          {now.toLocaleDateString("ko-KR", {
            month: "2-digit",
            day: "2-digit",
            weekday: "short",
          })}
        </span>
      </div>
      <RangeSelector value={range} onChange={onRange} />
      <div className="status-body">
        <span
          className={`network-dot ${staleCount ? "warn" : ""}`}
        />{" "}
        <strong>
          {demo ? "DEMO / MOCK" : staleCount ? `${staleCount}개 지연` : "LIVE"}
        </strong>
        <span>마지막 갱신</span>
        <time>{formatTime(lastUpdated)}</time>
      </div>
      <button className="refresh-button" onClick={onRefresh}>
        ↻ 지금 새로고침
      </button>
    </aside>
  );
}
