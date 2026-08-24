import { describe, expect, it } from "vitest";
import { ZADACHI_SEED } from "@/lib/zadachi-data";
import { assertLegalUciLine, assertZadachaLegal } from "@/lib/zadachi-validate";

describe("ZADACHI_SEED", () => {
  it("has unique ids", () => {
    const ids = ZADACHI_SEED.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ZADACHI_SEED)("$id has a legal UCI line", (z) => {
    expect(() => assertZadachaLegal(z)).not.toThrow();
  });

  it("rejects an illegal continuation", () => {
    expect(() =>
      assertLegalUciLine("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
        "e2e5",
      ])
    ).toThrow(/Illegal move/);
  });
});
