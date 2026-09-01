import Link from "next/link";

export type SoftSkillsPlacesView = {
  leaguePlace: number | null;
  classPlace: number | null;
  teamPlace: number | null;
  overallPlace: number | null;
  overallPoints: number;
  leagueLabel: string | null;
  className: string | null;
  teamLabel: string | null;
};

type Props = {
  displayName: string;
  username: string | null;
  softPlaces: SoftSkillsPlacesView | null;
  loading: boolean;
  showRatingsLink?: boolean;
};

export default function SoftSkillsProfileSection({
  displayName,
  username,
  softPlaces,
  loading,
  showRatingsLink = true,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="surface p-6">
        <h1 className="font-display text-xl font-semibold text-white">
          {displayName.trim() || username || "Профиль"}
        </h1>
        {username && <p className="mt-1 text-sm text-white/45">@{username}</p>}
        {softPlaces?.className && (
          <p className="mt-1 text-sm text-white/55">Класс: {softPlaces.className}</p>
        )}
        {softPlaces?.leagueLabel && (
          <p className="mt-0.5 text-sm text-white/55">Лига: {softPlaces.leagueLabel}</p>
        )}
        {softPlaces?.teamLabel && (
          <p className="mt-0.5 text-sm text-white/55">Команда: {softPlaces.teamLabel}</p>
        )}
      </div>
      <div className="surface-pad">
        <h2 className="font-display text-lg font-semibold text-white">Soft Skills</h2>
        {loading ? (
          <p className="mt-2 text-sm text-white/55">Загрузка мест…</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Место в лиге</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.leaguePlace ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Место в классе</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.classPlace ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Место в команде</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.teamPlace ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Общий рейтинг</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.overallPlace ?? "—"}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Баллы: {softPlaces?.overallPoints ?? 0}
              </p>
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-white/40">
          Места считаются по сумме баллов Soft Skills. Баллы появятся после внесения результатов.
        </p>
        {showRatingsLink && (
          <Link
            href="/ratings?section=soft-skills&view=overall"
            className="mt-3 inline-flex text-sm font-medium text-gold hover:text-gold-bright"
          >
            Открыть рейтинги Soft Skills
          </Link>
        )}
      </div>
    </div>
  );
}
