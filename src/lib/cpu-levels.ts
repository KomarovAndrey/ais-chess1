/** CPU difficulty levels powered by Stockfish Skill Level (1–8). */

export type CpuLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const CPU_LEVELS: CpuLevel[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const CPU_LEVEL_DESCRIPTIONS: Record<CpuLevel, string> = {
  1: "Новичок — Stockfish почти «спит», много ошибок.",
  2: "Любитель — слабый движок, подходит для старта.",
  3: "Клубный — уже считает короткие тактики.",
  4: "Средний — уверенная игра, нужны аккуратные ходы.",
  5: "Сильный — серьёзный спарринг.",
  6: "Кандидат — глубокий поиск, мало прощает.",
  7: "Мастер — очень сильный движок.",
  8: "Максимум — почти полный Stockfish lite.",
};

export const CPU_PERSONAS: Record<CpuLevel, { name: string; style: string }> = {
  1: { name: "Пешка", style: "Skill 0" },
  2: { name: "Конёк", style: "Skill 3" },
  3: { name: "Слон", style: "Skill 6" },
  4: { name: "Ладья", style: "Skill 10" },
  5: { name: "Ферзь", style: "Skill 13" },
  6: { name: "Король", style: "Skill 16" },
  7: { name: "Гросс", style: "Skill 18" },
  8: { name: "Stockfish", style: "Skill 20" },
};
