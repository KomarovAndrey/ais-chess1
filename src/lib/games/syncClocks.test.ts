import { describe, expect, it, vi, afterEach } from "vitest";
import { clocksAreRunning, interpolateClocks } from "@/lib/clocks";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("server wall-clock (no open tab)", () => {
  it("advances from last_move_at even without a client tick", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 45_000).toISOString();
    expect(clocksAreRunning(["e2e4"], last)).toBe(true);
    const live = interpolateClocks(180_000, 180_000, last, "b", {
      moves: ["e2e4"],
    });
    expect(live.blackTimeLeft).toBe(135_000);
    expect(live.whiteTimeLeft).toBe(180_000);
  });

  it("detects a fallen flag from wall clock alone", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 61_000).toISOString();
    const live = interpolateClocks(60_000, 180_000, last, "w", {
      moves: ["e2e4", "e7e5"],
    });
    expect(live.whiteTimeLeft).toBe(0);
  });
});
