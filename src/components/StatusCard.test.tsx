import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusCard } from "./StatusCard";

describe("StatusCard appliance state", () => {
  it("does not claim sleep when physical DPMS is unsupported", () => {
    render(
      <StatusCard
        range="1D"
        staleCount={0}
        onRange={vi.fn()}
        onRefresh={vi.fn()}
        onSettings={vi.fn()}
        appliance={{
          enabled: true,
          displayActive: false,
          displayPower: "unsupported",
          nextTransition: "07:00",
          detail: "Wayland unsupported",
        }}
      />,
    );
    expect(screen.getByText("NO DPMS")).toHaveAttribute(
      "title",
      "Wayland unsupported",
    );
    expect(screen.queryByText("SLEEP")).not.toBeInTheDocument();
  });

  it("keeps manual refresh available", () => {
    const refresh = vi.fn();
    const view = render(
      <StatusCard
        range="1M"
        staleCount={0}
        onRange={vi.fn()}
        onRefresh={refresh}
        onSettings={vi.fn()}
        appliance={{
          enabled: false,
          displayActive: true,
          displayPower: "unmanaged",
        }}
      />,
    );
    fireEvent.click(view.getByText("↻ 지금 새로고침"));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
