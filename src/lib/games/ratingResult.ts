import { ratingCategoryFromTimeControlSeconds } from "@/lib/timeControls";

export type RatingCategory = "bullet" | "blitz" | "rapid";

export type SideRatingResult = {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  provisional: boolean;
};

export type GameRatingResult = {
  rated: boolean;
  category: RatingCategory;
  white: SideRatingResult | null;
  black: SideRatingResult | null;
};

type HistoryRow = {
  user_id: string;
  game_id: string | null;
  category: RatingCategory;
  rating: number;
  created_at: string;
};

type ProfileGamesPlayed = {
  games_played_bullet?: number | null;
  games_played_blitz?: number | null;
  games_played_rapid?: number | null;
};

const PROVISIONAL_GAMES = 20;

export function pickProfileRating(
  profile: {
    rating?: number | null;
    rating_bullet?: number | null;
    rating_blitz?: number | null;
    rating_rapid?: number | null;
  } | null | undefined,
  category: RatingCategory
): number {
  const base = profile?.rating ?? 1500;
  if (category === "bullet") return profile?.rating_bullet ?? base;
  if (category === "blitz") return profile?.rating_blitz ?? base;
  return profile?.rating_rapid ?? base;
}

export function isProvisional(
  profile: ProfileGamesPlayed | null | undefined,
  category: RatingCategory
): boolean {
  const n =
    category === "bullet"
      ? profile?.games_played_bullet ?? 0
      : category === "blitz"
        ? profile?.games_played_blitz ?? 0
        : profile?.games_played_rapid ?? 0;
  return n < PROVISIONAL_GAMES;
}

/** Build per-side rating delta from rating_history rows for one finished rated game. */
export function buildGameRatingResult(
  rated: boolean,
  gameId: string,
  timeControlSeconds: number | null | undefined,
  whitePlayerId: string | null,
  blackPlayerId: string | null,
  historyRows: HistoryRow[],
  profilesById: Map<string, ProfileGamesPlayed>
): GameRatingResult {
  const category = ratingCategoryFromTimeControlSeconds(timeControlSeconds);
  const empty: GameRatingResult = {
    rated: false,
    category,
    white: null,
    black: null,
  };
  if (!rated) return empty;

  function sideResult(userId: string | null): SideRatingResult | null {
    if (!userId) return null;
    const row = historyRows.find(
      (r) =>
        r.user_id === userId &&
        r.category === category &&
        r.game_id === gameId
    );
    if (!row) return null;

    const prevRows = historyRows
      .filter(
        (r) =>
          r.user_id === userId &&
          r.category === category &&
          r.created_at < row.created_at
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const ratingBefore =
      prevRows.length > 0 ? prevRows[prevRows.length - 1].rating : row.rating;
    const ratingAfter = row.rating;
    const profile = profilesById.get(userId);
    return {
      ratingBefore,
      ratingAfter,
      delta: ratingAfter - ratingBefore,
      provisional: isProvisional(profile, category),
    };
  }

  return {
    rated: true,
    category,
    white: sideResult(whitePlayerId),
    black: sideResult(blackPlayerId),
  };
}

export function formatRatingDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "±0";
}

/** Lichess-style accuracy from average centipawn loss (ACPL). */
export function accuracyFromAcpl(acpl: number): number {
  if (!Number.isFinite(acpl) || acpl < 0) return 0;
  const raw = 103.1668 * Math.exp(-0.04354 * acpl) - 3.1669;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
