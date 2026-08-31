import { describe, expect, it } from "vitest";
import { gameChannelTopic } from "./broadcast";

describe("gameChannelTopic", () => {
  it("matches the client channel name used in play-game", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(gameChannelTopic(id)).toBe(`game:${id}`);
  });
});
