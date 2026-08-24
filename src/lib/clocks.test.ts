import { describe, expect, it, vi, afterEach } from "vitest";
import {
  applyIncrement,
  computeClocksAfterElapsed,
  computeStatusAndWinner,
} from "@/lib/games/integrity";
import { formatClockMs, interpolateClocks, clocksAreRunning, clocksBeforeMove, clocksAfterLegalMove } from "@/lib/clocks";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeClocksAfterElapsed / interpolateClocks", () => {
  it("subtracts elapsed only from the side to move", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 2500).toISOString();
    const r = computeClocksAfterElapsed(60_000, 45_000, last, "w");
    expect(r.whiteTimeLeft).toBe(57_500);
    expect(r.blackTimeLeft).toBe(45_000);
    expect(interpolateClocks(60_000, 45_000, last, "w")).toEqual(r);
  });

  it("subtracts from black when it is black to move", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 1000).toISOString();
    const r = computeClocksAfterElapsed(10_000, 8_000, last, "b");
    expect(r.whiteTimeLeft).toBe(10_000);
    expect(r.blackTimeLeft).toBe(7_000);
  });

  it("clamps at zero and does not go negative", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 20_000).toISOString();
    const r = computeClocksAfterElapsed(5_000, 9_000, last, "w");
    expect(r.whiteTimeLeft).toBe(0);
    expect(r.blackTimeLeft).toBe(9_000);
  });

  it("does not tick when lastMoveAt is null", () => {
    const r = computeClocksAfterElapsed(12_000, 8_000, null, "w");
    expect(r).toEqual({ whiteTimeLeft: 12_000, blackTimeLeft: 8_000 });
  });

  it("stays frozen for White's and Black's opening moves", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 5_000).toISOString();
    expect(interpolateClocks(60_000, 60_000, last, "w", { moves: [] })).toEqual({
      whiteTimeLeft: 60_000,
      blackTimeLeft: 60_000,
    });
    expect(interpolateClocks(60_000, 60_000, last, "b", { moves: ["e2e4"] })).toEqual({
      whiteTimeLeft: 60_000,
      blackTimeLeft: 60_000,
    });
  });

  it("ticks only after Black has also moved (plies >= 2, Lichess)", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 2_000).toISOString();
    const r = interpolateClocks(60_000, 60_000, last, "w", {
      moves: ["e2e4", "e7e5"],
    });
    expect(r.whiteTimeLeft).toBe(58_000);
    expect(r.blackTimeLeft).toBe(60_000);
  });
});

describe("Lichess clock start contract", () => {
  it("clocksAreRunning requires two plies and lastMoveAt", () => {
    expect(clocksAreRunning([], "2020-01-01T00:00:00.000Z")).toBe(false);
    expect(clocksAreRunning(["e2e4"], "2020-01-01T00:00:00.000Z")).toBe(false);
    expect(clocksAreRunning(["e2e4", "e7e5"], null)).toBe(false);
    expect(clocksAreRunning(["e2e4", "e7e5"], "2020-01-01T00:00:00.000Z")).toBe(true);
  });

  it("opening moves do not deduct time or apply increment", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 9_000).toISOString();
    const whiteOpen = clocksBeforeMove({
      whiteTimeLeft: 60_000,
      blackTimeLeft: 60_000,
      lastMoveAt: last,
      sideToMove: "w",
      movesBefore: [],
    });
    expect(whiteOpen.clocksWereRunning).toBe(false);
    const blackOpen = clocksBeforeMove({
      whiteTimeLeft: 60_000,
      blackTimeLeft: 60_000,
      lastMoveAt: last,
      sideToMove: "b",
      movesBefore: ["e2e4"],
    });
    expect(blackOpen).toEqual({
      whiteTimeLeft: 60_000,
      blackTimeLeft: 60_000,
      clocksWereRunning: false,
    });
    expect(
      clocksAfterLegalMove({
        whiteTimeLeft: blackOpen.whiteTimeLeft,
        blackTimeLeft: blackOpen.blackTimeLeft,
        movedSide: "b",
        incrementSeconds: 2,
        clocksWereRunning: false,
      })
    ).toEqual({ whiteTimeLeft: 60_000, blackTimeLeft: 60_000 });
  });

  it("after Black's first reply, White's elapsed is deducted and White gets increment", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const last = new Date(now - 3_000).toISOString();
    const before = clocksBeforeMove({
      whiteTimeLeft: 60_000,
      blackTimeLeft: 60_000,
      lastMoveAt: last,
      sideToMove: "w",
      movesBefore: ["e2e4", "e7e5"],
    });
    expect(before.clocksWereRunning).toBe(true);
    expect(before.whiteTimeLeft).toBe(57_000);
    expect(
      clocksAfterLegalMove({
        whiteTimeLeft: before.whiteTimeLeft,
        blackTimeLeft: before.blackTimeLeft,
        movedSide: "w",
        incrementSeconds: 2,
        clocksWereRunning: true,
      })
    ).toEqual({ whiteTimeLeft: 59_000, blackTimeLeft: 60_000 });
  });
});

describe("applyIncrement", () => {
  it("adds Fischer increment to the side that just moved", () => {
    expect(applyIncrement(1_000, 2_000, "w", 2)).toEqual({
      whiteTimeLeft: 3_000,
      blackTimeLeft: 2_000,
    });
    expect(applyIncrement(1_000, 2_000, "b", 1)).toEqual({
      whiteTimeLeft: 1_000,
      blackTimeLeft: 3_000,
    });
  });

  it("ignores zero or negative increment", () => {
    expect(applyIncrement(5_000, 5_000, "w", 0)).toEqual({
      whiteTimeLeft: 5_000,
      blackTimeLeft: 5_000,
    });
  });
});

describe("computeStatusAndWinner", () => {
  it("flags white timeout as black win", () => {
    expect(computeStatusAndWinner("startpos", 0, 5_000)).toEqual({
      status: "finished",
      winner: "black",
    });
  });

  it("flags black timeout as white win", () => {
    expect(computeStatusAndWinner("startpos", 5_000, 0)).toEqual({
      status: "finished",
      winner: "white",
    });
  });

  it("detects checkmate from FEN", () => {
    const foolsMate = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(computeStatusAndWinner(foolsMate, 30_000, 30_000)).toEqual({
      status: "finished",
      winner: "black",
    });
  });

  it("keeps an unfinished position active", () => {
    expect(computeStatusAndWinner("startpos", 30_000, 30_000)).toEqual({
      status: "active",
      winner: null,
    });
  });
});

describe("formatClockMs", () => {
  it("uses M:SS above ten seconds", () => {
    expect(formatClockMs(61_000)).toBe("1:01");
    expect(formatClockMs(10_000)).toBe("0:10");
  });

  it("shows tenths below ten seconds", () => {
    expect(formatClockMs(9_940)).toBe("0:09.9");
    expect(formatClockMs(1_050)).toBe("0:01.0");
    expect(formatClockMs(0)).toBe("0:00.0");
  });

  it("clamps negative values", () => {
    expect(formatClockMs(-500)).toBe("0:00.0");
  });
});
