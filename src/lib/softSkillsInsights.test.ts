import { describe, expect, it } from "vitest";
import {
  buildDisciplineStats,
  buildTrendByWeek,
} from "./softSkillsInsights";
import type { DisciplineEntryRow } from "./softSkillsCompetencies";
import type { FullDisciplineEntryRow, LeagueProfile } from "./softSkillsDisciplineIndex";

const profiles: LeagueProfile[] = [
  { id: "u1", soft_skills_league_id: "1", class_name: "5A" },
  { id: "u2", soft_skills_league_id: "1", class_name: "5A" },
];

function fullEntry(
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

function starEntry(
  partial: Partial<DisciplineEntryRow> & Pick<DisciplineEntryRow, "user_id">
): DisciplineEntryRow {
  return {
    module_id: "1",
    week_number: 1,
    star_leadership: null,
    star_communication: null,
    star_self_reflection: null,
    star_critical_thinking: null,
    star_self_control: null,
    ...partial,
  };
}

describe("buildTrendByWeek", () => {
  it("uses league peer cohort for discipline index", () => {
    const fullEntries = [
      fullEntry({
        user_id: "u1",
        discipline: "robo",
        time_value: "2:00",
        star_leadership: 0,
      }),
      fullEntry({
        user_id: "u2",
        discipline: "robo",
        time_value: "1:00",
        star_leadership: 0,
      }),
    ];
    const starEntries: DisciplineEntryRow[] = [];

    const trendU1 = buildTrendByWeek(starEntries, fullEntries, profiles, "u1", "1");
    const trendU2 = buildTrendByWeek(starEntries, fullEntries, profiles, "u2", "1");
    expect(trendU1).toHaveLength(1);
    expect(trendU2).toHaveLength(1);
    expect(trendU1[0]?.composite).not.toBeNull();
    expect(trendU2[0]?.composite).not.toBeNull();
    expect(trendU2[0]!.composite!).toBeGreaterThan(trendU1[0]!.composite!);
  });
});

describe("buildDisciplineStats", () => {
  it("computes group median from peer cohort, not solo user", () => {
    const fullEntries = [
      fullEntry({
        user_id: "u1",
        discipline: "robo",
        time_value: "2:00",
        star_leadership: 0,
      }),
      fullEntry({
        user_id: "u2",
        discipline: "robo",
        time_value: "1:00",
        star_leadership: 0,
      }),
    ];

    const stats = buildDisciplineStats(fullEntries, profiles, "u1", ["u1", "u2"], "1");
    const robo = stats.find((s) => s.discipline === "robo");
    expect(robo?.indexScore).not.toBeNull();
    expect(robo?.groupMedianIndex).not.toBeNull();
    expect(robo!.indexScore!).not.toEqual(robo!.groupMedianIndex!);
  });

  it("returns null index for stars-only entries", () => {
    const fullEntries = [
      fullEntry({ user_id: "u1", discipline: "lumo" }),
    ];
    const stats = buildDisciplineStats(fullEntries, profiles, "u1", ["u1"], "1");
    const lumo = stats.find((s) => s.discipline === "lumo");
    expect(lumo?.indexScore).toBeNull();
  });
});
