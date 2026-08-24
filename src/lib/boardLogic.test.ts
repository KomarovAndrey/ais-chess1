import { describe, expect, it } from "vitest";
import {
  fenWithTurn,
  legalDests,
  needsPromotion,
  promotionMenuPercent,
  squarePercent,
  START_FEN,
} from "@/lib/boardLogic";

describe("fenWithTurn", () => {
  it("flips the side to move", () => {
    expect(fenWithTurn(START_FEN, "b").split(" ")[1]).toBe("b");
    expect(fenWithTurn("startpos", "b").split(" ")[1]).toBe("b");
  });
});

describe("legalDests", () => {
  it("returns pawn dests on the side to move", () => {
    expect(legalDests(START_FEN, "e2")).toEqual(expect.arrayContaining(["e3", "e4"]));
  });

  it("returns premove dests when it is the opponent turn", () => {
    const blackToMove = fenWithTurn(START_FEN, "b");
    expect(legalDests(blackToMove, "e2")).toEqual(expect.arrayContaining(["e3", "e4"]));
  });

  it("returns empty dests for an empty square", () => {
    expect(legalDests(START_FEN, "e4")).toEqual([]);
  });
});

describe("needsPromotion", () => {
  it("detects a white pawn reaching the 8th rank", () => {
    const fen = "8/P7/8/8/8/8/8/4K2k w - - 0 1";
    expect(needsPromotion(fen, "a7", "a8")).toBe(true);
    expect(needsPromotion(fen, "e1", "e2")).toBe(false);
  });
});

describe("squarePercent / promotionMenuPercent", () => {
  it("maps a1 to the bottom-left for white", () => {
    expect(squarePercent("a1", "white")).toEqual({ left: 0, top: 87.5 });
  });

  it("maps a1 to the top-right for black", () => {
    expect(squarePercent("a1", "black")).toEqual({ left: 87.5, top: 0 });
  });

  it("drops the promotion menu down from the 8th rank (white view)", () => {
    expect(promotionMenuPercent("e8", "white")).toEqual({
      left: 50,
      top: 0,
      width: 12.5,
      height: 50,
    });
  });
});
