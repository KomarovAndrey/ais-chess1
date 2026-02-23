/** Simple tactical puzzles: FEN and solution (UCI). First move is the one the user must play. */
export interface Puzzle {
  id: string;
  fen: string;
  /** Correct move(s) in UCI. For "white to play" we only check the first move. */
  moves: string[];
  theme?: string;
}

export const PUZZLES: Puzzle[] = [
  {
    id: "mate1-1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    moves: ["h5f7"],
    theme: "Мат в 1 ход"
  },
  {
    id: "mate1-2",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    moves: ["h5f7"],
    theme: "Мат в 1 ход"
  },
  {
    id: "fork-1",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4",
    moves: ["c4f7"],
    theme: "Двойной удар"
  },
  {
    id: "pin-1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    moves: ["h5e5"],
    theme: "Связка"
  },
  {
    id: "capture-1",
    fen: "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
    moves: ["c4d5", "d5e6"],
    theme: "Взятие"
  },
  {
    id: "mate2-1",
    fen: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
    moves: ["f6e4"],
    theme: "Защита"
  },
  {
    id: "discover-1",
    fen: "r2qkb1r/ppp2ppp/2n1bn2/3pp3/4P3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 6",
    moves: ["d3e5"],
    theme: "Вскрытое нападение"
  },
  {
    id: "backrank-1",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    moves: ["e1e8"],
    theme: "Мат по последней горизонтали"
  }
];

export function getPuzzleByIndex(index: number): Puzzle | null {
  if (index < 0 || index >= PUZZLES.length) return null;
  return PUZZLES[index];
}

export function getRandomPuzzleIndex(exclude?: number): number {
  if (PUZZLES.length <= 1) return 0;
  let i = Math.floor(Math.random() * PUZZLES.length);
  if (exclude !== undefined && i === exclude) {
    i = (i + 1) % PUZZLES.length;
  }
  return i;
}
