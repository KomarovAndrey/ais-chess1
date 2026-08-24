/** Curated tactical tasks (Задачи). Fallback when DB is empty. */

export type Zadacha = {
  id: string;
  fen: string;
  /** Full line in UCI: player, opponent, player, ... */
  moves: string[];
  themes: string[];
  rating: number;
};

export const THEME_LABELS: Record<string, string> = {
  mate: "Мат",
  mateIn1: "Мат в 1",
  mateIn2: "Мат в 2",
  fork: "Вилка",
  pin: "Связка",
  skewer: "Сквозной удар",
  backRank: "Последняя горизонталь",
  material: "Материал",
  capture: "Взятие",
  hangingPiece: "Висячая фигура",
  discoveredAttack: "Вскрытое нападение",
  zwischenzug: "Промежуточный ход",
  endgame: "Эндшпиль",
  opening: "Дебют",
  sacrifice: "Жертва",
  defense: "Защита",
  doubleCheck: "Двойной шах",
  pawn: "Пешка",
};

export const ZADACHI_SEED: Zadacha[] = [
  {
    id: "mate1-1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    moves: ["h5f7"],
    themes: ["mateIn1", "mate"],
    rating: 800,
  },
  {
    id: "mate1-2",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    moves: ["e1e8"],
    themes: ["mateIn1", "backRank", "mate"],
    rating: 900,
  },
  {
    id: "fork-1",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4",
    moves: ["c4f7"],
    themes: ["fork", "material"],
    rating: 1000,
  },
  {
    id: "pin-1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    moves: ["h5e5"],
    themes: ["pin", "material"],
    rating: 1050,
  },
  {
    id: "capture-1",
    fen: "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
    moves: ["c4d5"],
    themes: ["capture", "opening"],
    rating: 950,
  },
  {
    id: "discover-1",
    fen: "r2qkb1r/ppp2ppp/2n1bn2/3pp3/4P3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 6",
    moves: ["f3e5"],
    themes: ["discoveredAttack", "material"],
    rating: 1200,
  },
  {
    id: "mate2-1",
    fen: "2r3k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1",
    moves: ["c1c8"],
    themes: ["mateIn1", "backRank", "mate"],
    rating: 1100,
  },
  {
    id: "mate2-2",
    fen: "6k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1",
    moves: ["f3f7", "g8h8", "f7f8"],
    themes: ["mateIn2", "mate"],
    rating: 1250,
  },
  {
    id: "skewer-1",
    fen: "q6k/8/8/8/8/8/8/R6K w - - 0 1",
    moves: ["a1a8"],
    themes: ["skewer", "endgame"],
    rating: 1000,
  },
  {
    id: "zwischenzug-1",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    moves: ["c4f7", "e8f7", "f3e5"],
    themes: ["zwischenzug", "fork", "material"],
    rating: 1400,
  },
  {
    id: "endgame-2",
    fen: "6k1/8/6K1/8/8/8/8/5R2 w - - 0 1",
    moves: ["f1f8"],
    themes: ["endgame", "mateIn1", "mate"],
    rating: 850,
  },
  {
    id: "tactic-1",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 6 5",
    moves: ["g5f7"],
    themes: ["fork", "material"],
    rating: 1180,
  },
  {
    id: "rook-lift",
    fen: "4r1k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    moves: ["e1e8"],
    themes: ["mateIn1", "backRank", "mate"],
    rating: 880,
  },
  {
    id: "deflection-1",
    fen: "6k1/5ppp/8/8/8/4Q3/5PPP/6K1 w - - 0 1",
    moves: ["e3e8"],
    themes: ["mateIn1", "mate"],
    rating: 900,
  },
  {
    id: "quiet-move",
    fen: "6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1",
    moves: ["d1d8"],
    themes: ["mateIn1", "mate"],
    rating: 860,
  },
];

export function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}
