import { describe, expect, it } from "vitest";
import {
  accuracyFromAcpl,
  buildGameRatingResult,
  formatRatingDelta,
} from "./ratingResult";

describe("ratingResult", () => {
  it("formats positive and negative deltas", () => {
    expect(formatRatingDelta(12)).toBe("+12");
    expect(formatRatingDelta(-8)).toBe("-8");
    expect(formatRatingDelta(0)).toBe("±0");
  });

  it("builds side rating results from history", () => {
    const result = buildGameRatingResult(
      true,
      "g1",
      300,
      "user-white",
      "user-black",
      [
        {
          user_id: "user-white",
          game_id: "g1",
          category: "blitz",
          rating: 1512,
          created_at: "2026-01-02T00:00:00Z",
        },
        {
          user_id: "user-white",
          game_id: "g0",
          category: "blitz",
          rating: 1500,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          user_id: "user-black",
          game_id: "g1",
          category: "blitz",
          rating: 1488,
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      new Map([
        ["user-white", { games_played_blitz: 5 }],
        ["user-black", { games_played_blitz: 25 }],
      ])
    );

    expect(result.rated).toBe(true);
    expect(result.white?.delta).toBe(12);
    expect(result.white?.provisional).toBe(true);
    expect(result.black?.delta).toBe(0);
    expect(result.black?.provisional).toBe(false);
  });

  it("maps ACPL to accuracy", () => {
    expect(accuracyFromAcpl(0)).toBeGreaterThan(95);
    expect(accuracyFromAcpl(200)).toBeLessThan(50);
  });
});
