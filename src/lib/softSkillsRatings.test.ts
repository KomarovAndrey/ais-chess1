import { describe, expect, it } from "vitest";
import { buildOverallBoard } from "./softSkillsRatings";

describe("buildOverallBoard / assignPlaces", () => {
  it("excludes provisional students from ranked places", () => {
    const profiles = [
      {
        id: "u1",
        username: "alice",
        display_name: "Alice",
        class_name: "5A",
        soft_skills_league_id: "1",
      },
      {
        id: "u2",
        username: "bob",
        display_name: "Bob",
        class_name: "5A",
        soft_skills_league_id: "1",
      },
    ];

    const starEntries = [
      {
        user_id: "u1",
        module_id: "1",
        week_number: 1,
        star_leadership: 5,
        star_communication: 5,
        star_self_reflection: 5,
        star_critical_thinking: null,
        star_self_control: null,
      },
      {
        user_id: "u2",
        module_id: "1",
        week_number: 1,
        star_leadership: 4,
        star_communication: 4,
        star_self_reflection: 4,
        star_critical_thinking: 4,
        star_self_control: 4,
      },
      {
        user_id: "u2",
        module_id: "1",
        week_number: 2,
        star_leadership: 4,
        star_communication: 4,
        star_self_reflection: 4,
        star_critical_thinking: 4,
        star_self_control: 4,
      },
      {
        user_id: "u2",
        module_id: "2",
        week_number: 1,
        star_leadership: 4,
        star_communication: 4,
        star_self_reflection: 4,
        star_critical_thinking: 4,
        star_self_control: 4,
      },
    ];

    const fullEntries = [
      {
        user_id: "u1",
        module_id: "1",
        week_number: 1,
        discipline: "robo",
        outcome: "win",
        result_value: null,
        error_count: 0,
        time_value: "1:00",
        team_time: null,
        personal_time: null,
        goals_count: 0,
        sport_error_count: 0,
        star_leadership: 5,
        star_communication: 5,
        star_self_reflection: 5,
        star_critical_thinking: null,
        star_self_control: null,
      },
      {
        user_id: "u2",
        module_id: "1",
        week_number: 1,
        discipline: "robo",
        outcome: "lose",
        result_value: null,
        error_count: 0,
        time_value: "2:00",
        team_time: null,
        personal_time: null,
        goals_count: 0,
        sport_error_count: 0,
        star_leadership: 4,
        star_communication: 4,
        star_self_reflection: 4,
        star_critical_thinking: 4,
        star_self_control: 4,
      },
    ];

    const board = buildOverallBoard(profiles, starEntries, fullEntries);
    const alice = board.find((r) => r.userId === "u1");
    const bob = board.find((r) => r.userId === "u2");

    expect(alice?.isProvisional).toBe(true);
    expect(alice?.place).toBe(0);
    expect(bob?.place).toBe(1);
  });
});
