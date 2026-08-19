import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusCard } from "./StatusCard";

describe("StatusCard web status", () => {
  it("keeps manual refresh available", () => {
    const refresh = vi.fn();
    const view = render(
      <StatusCard
        range="1M"
        staleCount={0}
        onRange={vi.fn()}
        onRefresh={refresh}
        onSettings={vi.fn()}
      />,
    );
    fireEvent.click(view.getByText("↻ 지금 새로고침"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("labels browser data as demo rather than live", () => {
    render(
      <StatusCard
        range="1D"
        staleCount={0}
        onRange={vi.fn()}
        onRefresh={vi.fn()}
        onSettings={vi.fn()}
        demo
      />,
    );
    expect(screen.getByText("DEMO / MOCK")).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });
});
