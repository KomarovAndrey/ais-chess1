"use client";

import { formatCompetency } from "@/lib/softSkillsCompetencies";

type HeatmapData = {
  modules: { id: string; label: string }[];
  skills: { id: string; label: string }[];
  values: (number | null)[][];
};

function cellColor(value: number | null): string {
  if (value == null) return "bg-white/5";
  if (value >= 4.5) return "bg-emerald-500/50";
  if (value >= 3.5) return "bg-emerald-500/30";
  if (value >= 2.5) return "bg-amber-500/30";
  if (value >= 1.5) return "bg-orange-500/30";
  return "bg-red-500/30";
}

type Props = {
  data: HeatmapData | null;
  loading?: boolean;
};

export default function SoftSkillsCompetencyHeatmap({ data, loading }: Props) {
  if (loading) {
    return <p className="text-sm text-white/55">Загрузка heatmap…</p>;
  }
  if (!data || data.skills.length === 0) {
    return <p className="text-sm text-white/55">Нет данных для heatmap.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left text-white/45" />
            {data.modules.map((m) => (
              <th key={m.id} className="p-2 text-center font-medium text-white/45">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.skills.map((skill, rowIdx) => (
            <tr key={skill.id}>
              <td className="p-2 font-medium text-white/70">{skill.label}</td>
              {data.modules.map((m, colIdx) => {
                const val = data.values[rowIdx]?.[colIdx] ?? null;
                return (
                  <td key={m.id} className="p-1">
                    <div
                      className={`rounded-lg px-2 py-3 text-center font-semibold tabular-nums text-white ${cellColor(val)}`}
                      title={skill.label}
                    >
                      {formatCompetency(val)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
