import type { ChartRange } from "../types/market";
export function RangeSelector({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (range: ChartRange) => void;
}) {
  return (
    <div className="range-selector" aria-label="차트 기간">
      {(["1D", "1M"] as const).map((range) => (
        <button
          key={range}
          className={value === range ? "active" : ""}
          aria-pressed={value === range}
          onClick={() => onChange(range)}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
