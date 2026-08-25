import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { assertLegalUciLine } from "@/lib/zadachi-validate";

type Imported = {
  id: string;
  fen: string;
  moves: string[];
  themes: string[];
  rating: number;
};

describe("Lichess import artifact", () => {
  const path = join(process.cwd(), "data", "zadachi-lichess.json");

  it("exists with at least 10k puzzles", () => {
    expect(existsSync(path)).toBe(true);
    const raw = JSON.parse(readFileSync(path, "utf8")) as Imported[];
    expect(raw.length).toBeGreaterThanOrEqual(10_000);
  });

  it("sample of imported lines is legal from the stored FEN", () => {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Imported[];
    const step = Math.max(1, Math.floor(raw.length / 50));
    for (let i = 0; i < raw.length; i += step) {
      const z = raw[i];
      expect(z.moves.length).toBeGreaterThanOrEqual(1);
      expect(() => assertLegalUciLine(z.fen, z.moves)).not.toThrow();
      // Player to move after Lichess setup conversion
      const turn = z.fen.split(" ")[1];
      expect(turn === "w" || turn === "b").toBe(true);
      const c = new Chess(z.fen);
      expect(c.turn()).toBe(turn);
    }
  });
});
