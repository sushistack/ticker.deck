import { useMemo } from "react";
import type { ChartPoint } from "../types/market";
export function Sparkline({
  points,
  direction,
}: {
  points: ChartPoint[];
  direction: "up" | "down";
}) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const span = Math.max(Math.max(...prices) - min, 0.000001);
    return points
      .map(
        (point, index) =>
          `${index ? "L" : "M"} ${((index / (points.length - 1)) * 100).toFixed(2)} ${(33 - ((point.price - min) / span) * 30).toFixed(2)}`,
      )
      .join(" ");
  }, [points]);
  if (!path) return <div className="chart-empty">데이터 대기 중</div>;
  return (
    <svg
      className={`sparkline ${direction}`}
      viewBox="0 0 100 36"
      preserveAspectRatio="none"
      aria-label={`${direction === "up" ? "상승" : "하락"} 가격 추이`}
    >
      <path className="spark-fill" d={`${path} L 100 36 L 0 36 Z`} />
      <path className="spark-line" d={path} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
