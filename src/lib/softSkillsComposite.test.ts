import { describe, expect, it } from "vitest";
import { computeCompositeScore } from "./softSkillsComposite";

describe("computeCompositeScore", () => {
  it("returns none when both parts missing", () => {
    expect(computeCompositeScore(null, null)).toEqual({
      score: 0,
      isPartial: false,
      mode: "none",
    });
  });

  it("uses full 70/30 blend when both parts exist", () => {
    const result = computeCompositeScore(4, 3);
    expect(result.mode).toBe("full");
    expect(result.isPartial).toBe(false);
    expect(result.score).toBe(3.7);
  });

  it("does not blend when only competencies exist", () => {
    const result = computeCompositeScore(4.2, null);
    expect(result.mode).toBe("competency_only");
    expect(result.isPartial).toBe(true);
    expect(result.score).toBe(4.2);
  });

  it("does not blend when only discipline index exists", () => {
    const result = computeCompositeScore(null, 3.5);
    expect(result.mode).toBe("discipline_only");
    expect(result.isPartial).toBe(true);
    expect(result.score).toBe(3.5);
  });
});
