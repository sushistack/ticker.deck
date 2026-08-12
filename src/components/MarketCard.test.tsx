import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketCard } from "./MarketCard";
const instrument = { symbol: "NVDA", label: "NVDA", type: "stock" as const };
describe("MarketCard", () => {
  it("shows textual falling direction and stale state", () => {
    const { container } = render(
      <MarketCard
        instrument={instrument}
        range="1D"
        snapshot={{
          symbol: "NVDA",
          quote: {
            symbol: "NVDA",
            price: 182.31,
            previousClose: 184,
            change: 99,
            changePercent: 99,
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
    expect(screen.getByText("1D")).toBeInTheDocument();
    expect(screen.getByText("182.31")).toBeInTheDocument();
    expect(container.querySelector(".change")).toHaveTextContent(
      "▼ −1.69 (−0.92%)",
    );
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "STRONG" && element.textContent === "(−0.92%)",
      ),
    ).toBeInTheDocument();
  });
});
