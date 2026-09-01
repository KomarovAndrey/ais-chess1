import {
  formatTimeControl,
  ratingCategoryFromTimeControlSeconds,
} from "@/lib/timeControls";

export type LobbySeekRow = {
  id: string;
  user_id: string;
  time_control_seconds: number;
  increment_seconds: number;
  rated: boolean;
  color: "white" | "black" | "random";
  created_at: string;
  status: string;
};

export type LobbySeekCard = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  rating: number;
  timeControlSeconds: number;
  incrementSeconds: number;
  timeLabel: string;
  rated: boolean;
  color: "white" | "black" | "random";
  createdAt: string;
  category: "bullet" | "blitz" | "rapid";
};

export function ratingForSeek(
  profile: {
    rating?: number | null;
    rating_bullet?: number | null;
    rating_blitz?: number | null;
    rating_rapid?: number | null;
  } | null | undefined,
  timeControlSeconds: number
): number {
  const cat = ratingCategoryFromTimeControlSeconds(timeControlSeconds);
  const base = profile?.rating ?? 1500;
  if (cat === "bullet") return profile?.rating_bullet ?? base;
  if (cat === "blitz") return profile?.rating_blitz ?? base;
  return profile?.rating_rapid ?? base;
}

export function toLobbySeekCard(
  row: LobbySeekRow,
  profile: {
    username?: string | null;
    display_name?: string | null;
    rating?: number | null;
    rating_bullet?: number | null;
    rating_blitz?: number | null;
    rating_rapid?: number | null;
  } | null | undefined
): LobbySeekCard {
  const time = row.time_control_seconds;
  const inc = row.increment_seconds ?? 0;
  return {
    id: row.id,
    userId: row.user_id,
    username: profile?.username ?? null,
    displayName: profile?.display_name || profile?.username || "Игрок",
    rating: ratingForSeek(profile, time),
    timeControlSeconds: time,
    incrementSeconds: inc,
    timeLabel: formatTimeControl(time, inc),
    rated: Boolean(row.rated),
    color: row.color,
    createdAt: row.created_at,
    category: ratingCategoryFromTimeControlSeconds(time),
  };
}

export function colorLabel(color: LobbySeekCard["color"]): string {
  if (color === "white") return "ищут белыми";
  if (color === "black") return "ищут чёрными";
  return "цвет случайный";
}
