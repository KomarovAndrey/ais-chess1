import { describe, expect, it } from "vitest";
import { colorLabel, ratingForSeek, toLobbySeekCard } from "./lobby";

describe("lobby helpers", () => {
  it("picks rating by time-control category", () => {
    const profile = {
      rating: 1500,
      rating_bullet: 1200,
      rating_blitz: 1400,
      rating_rapid: 1600,
    };
    expect(ratingForSeek(profile, 60)).toBe(1200);
    expect(ratingForSeek(profile, 300)).toBe(1400);
    expect(ratingForSeek(profile, 600)).toBe(1600);
  });

  it("builds a lobby card with time label", () => {
    const card = toLobbySeekCard(
      {
        id: "s1",
        user_id: "u1",
        time_control_seconds: 180,
        increment_seconds: 2,
        rated: true,
        color: "random",
        created_at: "2026-01-01T00:00:00Z",
        status: "pending",
      },
      { username: "alice", display_name: "Alice", rating_blitz: 1550 }
    );
    expect(card.timeLabel).toBe("3+2");
    expect(card.displayName).toBe("Alice");
    expect(card.rating).toBe(1550);
    expect(card.category).toBe("blitz");
  });

  it("labels color preference in Russian", () => {
    expect(colorLabel("white")).toContain("белыми");
    expect(colorLabel("black")).toContain("чёрными");
    expect(colorLabel("random")).toContain("случайный");
  });
});
