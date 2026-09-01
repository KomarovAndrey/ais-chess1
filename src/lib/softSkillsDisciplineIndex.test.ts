import { describe, expect, it } from "vitest";
import {
  aggregateDisciplineIndex,
  hasDisciplinePerformanceData,
  type FullDisciplineEntryRow,
  type LeagueProfile,
} from "./softSkillsDisciplineIndex";

const profiles: LeagueProfile[] = [
  { id: "u1", soft_skills_league_id: "1", class_name: "5A" },
  { id: "u2", soft_skills_league_id: "1", class_name: "5A" },
  { id: "u3", soft_skills_league_id: "2", class_name: "6B" },
];

function baseEntry(
  partial: Partial<FullDisciplineEntryRow> & Pick<FullDisciplineEntryRow, "user_id" | "discipline">
): FullDisciplineEntryRow {
  return {
    module_id: "1",
    week_number: 1,
    outcome: null,
    result_value: null,
    error_count: 0,
    time_value: null,
    team_time: null,
    personal_time: null,
    goals_count: 0,
    sport_error_count: 0,
    star_leadership: 5,
    star_communication: 5,
    star_self_reflection: 5,
    star_critical_thinking: 5,
    star_self_control: 5,
    ...partial,
  };
}

describe("hasDisciplinePerformanceData", () => {
  it("ignores stars-only lumo entries", () => {
    expect(
      hasDisciplinePerformanceData(
        baseEntry({ user_id: "u1", discipline: "lumo", star_leadership: 4 })
      )
    ).toBe(false);
  });

  it("counts lumo when result or errors provided", () => {
    expect(
      hasDisciplinePerformanceData(
        baseEntry({ user_id: "u1", discipline: "lumo", result_value: "12" })
      )
    ).toBe(true);
    expect(
      hasDisciplinePerformanceData(
        baseEntry({ user_id: "u1", discipline: "lumo", error_count: 2 })
      )
    ).toBe(true);
  });
});

describe("aggregateDisciplineIndex", () => {
  it("returns empty snapshot for stars-only entries", () => {
    const entries = [
      baseEntry({ user_id: "u1", discipline: "lumo" }),
      baseEntry({ user_id: "u1", discipline: "sport", goals_count: 0 }),
    ];
    const snap = aggregateDisciplineIndex(entries, profiles, { userId: "u1" });
    expect(snap.overall).toBeNull();
    expect(snap.entriesCount).toBe(0);
  });

  it("normalizes within league peers on same week", () => {
    const entries = [
      baseEntry({
        user_id: "u1",
        discipline: "robo",
        time_value: "1:00",
        star_leadership: 0,
      }),
      baseEntry({
        user_id: "u2",
        discipline: "robo",
        time_value: "2:00",
        star_leadership: 0,
      }),
      baseEntry({
        user_id: "u3",
        discipline: "robo",
        time_value: "0:30",
        star_leadership: 0,
      }),
    ];

    const u1 = aggregateDisciplineIndex(entries, profiles, { userId: "u1" });
    const u3 = aggregateDisciplineIndex(entries, profiles, { userId: "u3" });

    expect(u1.overall).not.toBeNull();
    expect(u3.overall).not.toBeNull();
    expect(u1.overall!).toBeGreaterThan(u3.overall!);
  });
});
