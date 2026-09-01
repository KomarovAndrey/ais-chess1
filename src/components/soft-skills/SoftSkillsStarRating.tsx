"use client";

import { Star } from "lucide-react";
import { SOFT_SKILLS_STAR_SKILLS, type SoftSkillsStarSkillId } from "@/lib/softSkillsDisciplines";

type Props = {
  stars: Record<SoftSkillsStarSkillId, number>;
  onChange: (skillId: SoftSkillsStarSkillId, value: number) => void;
  disabled?: boolean;
};

export default function SoftSkillsStarRating({ stars, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      {SOFT_SKILLS_STAR_SKILLS.map((skill) => (
        <div key={skill.id} className="flex items-center justify-between gap-3">
          <span className="text-xs text-white/55">{skill.label}</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = (stars[skill.id] ?? 0) >= value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(skill.id, stars[skill.id] === value ? 0 : value)}
                  className="rounded p-0.5 transition hover:scale-110 disabled:opacity-50"
                  aria-label={`${skill.label}: ${value} из 5`}
                >
                  <Star
                    className={`h-4 w-4 ${
                      filled ? "fill-gold text-gold" : "text-white/25"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
