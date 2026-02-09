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

export const moveBodySchema = z.object({
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
    .max(86400 * 1000 * 2, "blackTimeLeft out of range")
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;
export type MoveBodyInput = z.infer<typeof moveBodySchema>;
