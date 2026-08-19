// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parsePort, resolveStaticDir } from "./runtime.js";

describe("production runtime configuration", () => {
  it("resolves root dist from the compiled server directory", () => {
    expect(resolveStaticDir("/app/server-dist/server", undefined)).toBe(
      "/app/dist",
    );
  });

  it("validates the listening port", () => {
    expect(parsePort("8080")).toBe(8080);
    expect(() => parsePort("0")).toThrow();
    expect(() => parsePort("1.5")).toThrow();
    expect(() => parsePort("70000")).toThrow();
  });
});
