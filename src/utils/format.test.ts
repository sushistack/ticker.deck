import { describe, expect, it } from "vitest";
import { formatPrice, formatSigned, priceDecimals } from "./format";
describe("market formatting", () => {
  it("uses meaningful precision", () => {
    expect(formatPrice(116320)).toBe("116,320");
    expect(formatPrice(3820.42)).toBe("3,820.42");
    expect(formatPrice(0.23184)).toBe("0.23184");
    expect(priceDecimals(0.01)).toBe(6);
  });
  it("adds direction independent of color", () => {
    expect(formatSigned(2.31, "%")).toBe("+2.31%");
    expect(formatSigned(-0.72, "%")).toBe("−0.72%");
  });
});
