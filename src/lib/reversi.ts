/** Reversi (Othello) game logic. Board 8x8, "black" | "white". */

export type Cell = "black" | "white" | null;
export type Board = Cell[][];

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

function createEmptyBoard(): Board {
  return Array(8).fill(null).map(() => Array(8).fill(null));
}

export function createInitialBoard(): Board {
  const board = createEmptyBoard();
  board[3][3] = "white";
  board[3][4] = "black";
  board[4][3] = "black";
  board[4][4] = "white";
  return board;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

/** Returns pieces that would be flipped in one direction if we place at (r, c). */
function flipsInDirection(
  board: Board,
  r: number,
  c: number,
  player: "black" | "white",
  dr: number,
  dc: number
): [number, number][] {
  const opponent = player === "black" ? "white" : "black";
  const out: [number, number][] = [];
  let nr = r + dr;
  let nc = c + dc;
  while (inBounds(nr, nc) && board[nr][nc] === opponent) {
    out.push([nr, nc]);
    nr += dr;
    nc += dc;
  }
  if (out.length === 0 || !inBounds(nr, nc) || board[nr][nc] !== player) return [];
  return out;
}

export function getValidMoves(board: Board, player: "black" | "white"): [number, number][] {
  const moves: [number, number][] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] !== null) continue;
      let canFlip = false;
      for (const [dr, dc] of DIRS) {
        if (flipsInDirection(board, r, c, player, dr, dc).length > 0) {
          canFlip = true;
          break;
        }
      }
      if (canFlip) moves.push([r, c]);
    }
  }
  return moves;
}

export function makeMove(
  board: Board,
  r: number,
  c: number,
  player: "black" | "white"
): Board | null {
  const moves = getValidMoves(board, player);
  if (!moves.some(([mr, mc]) => mr === r && mc === c)) return null;
  const next = board.map((row) => row.slice());
  next[r][c] = player;
  for (const [dr, dc] of DIRS) {
    const toFlip = flipsInDirection(board, r, c, player, dr, dc);
    for (const [fr, fc] of toFlip) next[fr][fc] = player;
  }
  return next;
}

export function countPieces(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === "black") black++;
      else if (board[r][c] === "white") white++;
    }
  }
  return { black, white };
}

export function getWinner(board: Board): "black" | "white" | "draw" | null {
  const blackMoves = getValidMoves(board, "black");
  const whiteMoves = getValidMoves(board, "white");
  if (blackMoves.length > 0 || whiteMoves.length > 0) return null;
  const { black, white } = countPieces(board);
  if (black > white) return "black";
  if (white > black) return "white";
  return "draw";
}
