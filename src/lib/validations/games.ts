import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** FEN: max length to prevent huge payloads; allow "startpos" or FEN-like string */
const FEN_MAX_LENGTH = 200;
const FEN_REGEX = /^(startpos|[0-9pnbrqkPNBRQK/\s+-]+)$/;

export const createGameSchema = z.object({
  creatorColor: z.enum(["white", "black", "random"]),
  timeControlSeconds: z
    .number()
    .int()
    .min(1, "Time control must be at least 1 second")
    .max(86400, "Time control must be at most 24 hours"),
  playerId: z.string().optional()
});

export const joinGameSchema = z.object({
  gameId: z.string().regex(UUID_REGEX, "Invalid gameId format"),
  playerId: z.string().optional()
});

/** UCI move: e.g. e2e4 or e7e8q (promotion) */
const UCI_REGEX = /^[a-h][1-8][a-h][1-8][qnrb]?$/i;

const moveBodySchemaUci = z.object({
  uci: z.string().min(4).max(5).regex(UCI_REGEX, "Invalid UCI move format"),
  playerId: z.string().uuid().optional()
});

const moveBodySchemaLegacy = z.object({
  fen: z
    .string()
    .min(1, "fen is required")
    .max(FEN_MAX_LENGTH)
    .regex(FEN_REGEX, "Invalid FEN format"),
  activeColor: z.enum(["w", "b"]),
  whiteTimeLeft: z
    .number()
    .int()
    .min(0, "whiteTimeLeft must be non-negative")
    .max(86400 * 1000 * 2, "whiteTimeLeft out of range"),
  blackTimeLeft: z
    .number()
    .int()
    .min(0, "blackTimeLeft must be non-negative")
    .max(86400 * 1000 * 2, "blackTimeLeft out of range"),
  status: z.enum(["waiting", "active", "finished"]).optional(),
  winner: z.enum(["white", "black", "draw"]).nullable().optional(),
  playerId: z.string().uuid().optional()
});

/** Accept either UCI (preferred) or legacy FEN + clocks */
export const moveBodySchema = z.union([moveBodySchemaUci, moveBodySchemaLegacy]);
