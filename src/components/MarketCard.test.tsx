import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketCard } from "./MarketCard";
const instrument = { symbol: "NVDA", label: "NVDA", type: "stock" as const };
describe("MarketCard", () => {
  it("shows textual falling direction and stale state", () => {
    render(
      <MarketCard
        instrument={instrument}
        snapshot={{
          symbol: "NVDA",
          quote: {
            symbol: "NVDA",
            price: 182.31,
            previousClose: 184,
            change: -1.69,
            changePercent: -0.92,
            timestamp: 1,
          },
          chart: [
            { timestamp: 1, price: 184 },
            { timestamp: 2, price: 182.31 },
          ],
          stale: true,
          error: "timeout",
        }}
      />,
    );
    expect(screen.getByText("▼")).toBeInTheDocument();
    expect(screen.getByText("STALE")).toBeInTheDocument();
    expect(screen.getByText("182.31")).toBeInTheDocument();
  });
});
