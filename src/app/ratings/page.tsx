import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

type RatingRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  rating_bullet?: number | null;
  rating_blitz?: number | null;
  rating_rapid?: number | null;
  rating?: number | null;
};

export default async function RatingsPage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const type = sp.type === "bullet" || sp.type === "rapid" || sp.type === "blitz" ? sp.type : "blitz";

  const supabase = await createClient();
  if (!supabase) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
          <h1 className="text-xl font-bold text-slate-900">Рейтинги</h1>
          <p className="mt-2 text-sm text-slate-600">Сервер не настроен.</p>
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Рейтинги</h1>
            <p className="mt-1 text-sm text-slate-600">
              Топ игроков {type === "bullet" ? "Bullet" : type === "rapid" ? "Rapid" : "Blitz"}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            На главную
          </Link>
        </div>

        <div className="mb-4 flex gap-2">
          <Link
            href="/ratings?type=bullet"
            className={`rounded-xl border px-3 py-2 text-sm font-medium shadow-sm ${
              type === "bullet" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Bullet
          </Link>
          <Link
            href="/ratings?type=blitz"
            className={`rounded-xl border px-3 py-2 text-sm font-medium shadow-sm ${
              type === "blitz" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Blitz
          </Link>
          <Link
            href="/ratings?type=rapid"
            className={`rounded-xl border px-3 py-2 text-sm font-medium shadow-sm ${
              type === "rapid" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Rapid
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-lg backdrop-blur">
          <div className="grid grid-cols-[56px_1fr_96px] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <div>#</div>
            <div>Игрок</div>
            <div className="text-right">Рейтинг</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-600">Пока нет данных.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r, idx) => (
                <li key={r.id} className="grid grid-cols-[56px_1fr_96px] items-center px-4 py-3 hover:bg-slate-50">
                  <div className="text-sm font-semibold text-slate-500">{idx + 1}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {r.display_name?.trim() || r.username || "Игрок"}
                    </div>
                    {r.username && (
                      <div className="truncate text-xs text-slate-500">
                        <Link className="hover:underline" href={`/user/${encodeURIComponent(r.username)}`}>
                          {r.username}
                        </Link>
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm font-bold text-amber-600">{pick(r)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

