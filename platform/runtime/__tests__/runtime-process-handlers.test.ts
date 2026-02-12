import { describe, expect, it } from "vitest";

describe("Process Handlers", () => {
  it("registers unhandled rejection handler", () => {
    const listeners = process.listeners("unhandledRejection");
    expect(listeners.length).toBeGreaterThan(0);
  });

  it("registers uncaught exception handler", () => {
    const listeners = process.listeners("uncaughtException");
    expect(listeners.length).toBeGreaterThan(0);
  });
});
