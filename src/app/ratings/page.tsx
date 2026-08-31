import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

const SOFT_SKILLS_LEAGUES = [
  { id: "1", label: "Лига 1" },
  { id: "2", label: "Лига 2" },
  { id: "3", label: "Лига 3" },
  { id: "4", label: "Лига 4" },
] as const;

type SoftSkillsLeagueId = (typeof SOFT_SKILLS_LEAGUES)[number]["id"];

type RatingRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  rating_bullet?: number | null;
  rating_blitz?: number | null;
  rating_rapid?: number | null;
  rating?: number | null;
};

type Section = "chess" | "soft-skills";

export default async function RatingsPage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string; section?: string; league?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const section: Section = sp.section === "soft-skills" ? "soft-skills" : "chess";
  const type =
    sp.type === "bullet" || sp.type === "rapid" || sp.type === "blitz" ? sp.type : "blitz";

  if (section === "soft-skills") {
    const leagueId: SoftSkillsLeagueId =
      SOFT_SKILLS_LEAGUES.find((l) => l.id === sp.league)?.id ?? "1";
    const leagueLabel =
      SOFT_SKILLS_LEAGUES.find((l) => l.id === leagueId)?.label ?? "Лига 1";

    return (
      <main className="page-bg min-h-screen">
        <div className="page-shell max-w-3xl">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="page-title">Рейтинги</h1>
              <p className="page-subtitle">Soft Skills · {leagueLabel}</p>
            </div>
            <Link href="/" className="btn-secondary">
              На главную
            </Link>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Link href="/ratings?section=chess&type=blitz" className="tab-pill">
              Шахматы
            </Link>
            <span className="tab-pill-active">Soft Skills</span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {SOFT_SKILLS_LEAGUES.map((league) => (
              <Link
                key={league.id}
                href={`/ratings?section=soft-skills&league=${league.id}`}
                className={leagueId === league.id ? "tab-pill-active" : "tab-pill"}
              >
                {league.label}
              </Link>
            ))}
          </div>

          <div className="surface overflow-hidden">
            <div className="grid grid-cols-[56px_1fr_72px] gap-0 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/45">
              <div>#</div>
              <div>Участник</div>
              <div className="text-right">Балл</div>
            </div>
            <div className="px-4 py-6 text-sm text-white/55">
              Пока нет данных в {leagueLabel.toLowerCase()}.
            </div>
          </div>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return (
      <main className="page-bg min-h-screen">
        <div className="page-shell">
          <div className="surface-pad">
            <h1 className="page-title">Рейтинги</h1>
            <p className="page-subtitle">Сервер не настроен.</p>
          </div>
        </div>
      </main>
    );
  }

  const orderCol =
    type === "bullet" ? "rating_bullet" : type === "rapid" ? "rating_rapid" : "rating_blitz";
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, rating, rating_bullet, rating_blitz, rating_rapid")
    .not("username", "is", null)
    .not(orderCol, "is", null)
    .order(orderCol, { ascending: false })
    .limit(100);

  const rows = (data ?? []) as RatingRow[];
  const pick = (r: RatingRow) => {
    const legacy = r.rating ?? 1500;
    if (type === "bullet") return (r.rating_bullet ?? legacy) ?? 1500;
    if (type === "rapid") return (r.rating_rapid ?? legacy) ?? 1500;
    return (r.rating_blitz ?? legacy) ?? 1500;
  };

  const label = type === "bullet" ? "Bullet" : type === "rapid" ? "Rapid" : "Blitz";

  return (
    <main className="page-bg min-h-screen">
      <div className="page-shell max-w-3xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Рейтинги</h1>
            <p className="page-subtitle">Топ игроков · {label}</p>
          </div>
          <Link href="/" className="btn-secondary">
            На главную
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span className="tab-pill-active">Шахматы</span>
          <Link href="/ratings?section=soft-skills&league=1" className="tab-pill">
            Soft Skills
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["bullet", "Bullet"],
              ["blitz", "Blitz"],
              ["rapid", "Rapid"],
            ] as const
          ).map(([key, name]) => (
            <Link
              key={key}
              href={`/ratings?section=chess&type=${key}`}
              className={type === key ? "tab-pill-active" : "tab-pill"}
            >
              {name}
            </Link>
          ))}
        </div>

        <div className="surface overflow-hidden">
          <div className="grid grid-cols-[56px_1fr_96px] gap-0 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/45">
            <div>#</div>
            <div>Игрок</div>
            <div className="text-right">Рейтинг</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/55">Пока нет данных.</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {rows.map((r, idx) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[56px_1fr_96px] items-center px-4 py-3 transition hover:bg-white/[0.04]"
                >
                  <div className="text-sm font-semibold text-white/40">{idx + 1}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {r.display_name?.trim() || r.username || "Игрок"}
                    </div>
                    {r.username && (
                      <div className="truncate text-xs text-white/45">
                        <Link className="hover:text-gold" href={`/user/${encodeURIComponent(r.username)}`}>
                          {r.username}
                        </Link>
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm font-bold text-gold">{pick(r)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
