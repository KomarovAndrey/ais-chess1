import { Chess } from "chess.js";
import type { Zadacha } from "@/lib/zadachi-data";

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Every UCI in a puzzle line must be legal from the starting FEN, in order. */
export function assertLegalUciLine(fen: string, moves: string[]): void {
  if (!moves.length) {
    throw new Error("Puzzle line is empty");
  }
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch (e) {
    throw new Error(`Invalid FEN: ${fen} (${e instanceof Error ? e.message : e})`);
  }
  for (let i = 0; i < moves.length; i++) {
    const uci = moves[i];
    if (!UCI_RE.test(uci)) {
      throw new Error(`Invalid UCI "${uci}" at ply ${i}`);
    }
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    let played;
    try {
      played = chess.move({
        from,
        to,
        promotion: promotion as "q" | "r" | "b" | "n" | undefined,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Illegal move ${uci} at ply ${i} (fen ${chess.fen()}): ${detail}`);
    }
    if (!played) {
      throw new Error(`Illegal move ${uci} at ply ${i} (fen ${chess.fen()})`);
    }
  }
}

export function assertZadachaLegal(z: Zadacha): void {
  try {
    assertLegalUciLine(z.fen, z.moves);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Puzzle ${z.id}: ${msg}`);
  }
}
