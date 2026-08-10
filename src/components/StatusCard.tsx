import type { ApplianceStatus, ChartRange } from "../types/market";
import { formatTime } from "../utils/format";
import {
  closeWindow,
  minimizeWindow,
  startDragging,
} from "../services/windowControls";
import { RangeSelector } from "./RangeSelector";
export function StatusCard({
  range,
  lastUpdated,
  staleCount,
  onRange,
  onRefresh,
  onSettings,
  appliance,
}: {
  range: ChartRange;
  lastUpdated?: number;
  staleCount: number;
  onRange: (range: ChartRange) => void;
  onRefresh: () => void;
  onSettings: () => void;
  appliance: ApplianceStatus;
}) {
  const applianceLabel =
    appliance.displayPower === "unsupported"
      ? "NO DPMS"
      : appliance.displayPower === "error"
        ? "DPMS ERR"
        : appliance.displayPower === "prewarming"
          ? "PREWARM"
          : appliance.displayActive
            ? "DISPLAY ON"
            : "SLEEP";
  const applianceProblem =
    appliance.displayPower === "unsupported" ||
    appliance.displayPower === "error";
  return (
    <aside className="status-card">
      <div className="status-top" onMouseDown={startDragging}>
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
          <button
            className="icon-button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={minimizeWindow}
            aria-label="창 최소화"
          >
            −
          </button>
          <button
            className="icon-button close"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={closeWindow}
            aria-label="앱 닫기"
          >
            ×
          </button>
        </div>
      </div>
      <RangeSelector value={range} onChange={onRange} />
      <div className="status-body">
        <span
          className={`network-dot ${staleCount || applianceProblem ? "warn" : ""}`}
        />{" "}
        <strong>{staleCount ? `${staleCount}개 지연` : "LIVE"}</strong>
        {appliance.enabled && (
          <>
            <span title={appliance.detail}>{applianceLabel}</span>
            <time>{appliance.nextTransition ?? "--:--"}</time>
          </>
        )}
        <span>마지막 갱신</span>
        <time>{formatTime(lastUpdated)}</time>
      </div>
      <button className="refresh-button" onClick={onRefresh}>
        ↻ 지금 새로고침
      </button>
    </aside>
  );
}
