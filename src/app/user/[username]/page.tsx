"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SoftSkillsProfileSection, {
  type SoftSkillsDashboardView,
  type SoftSkillsPlacesView,
} from "@/components/soft-skills/SoftSkillsProfileSection";

type ProfileInfo = {
  id: string;
  username: string | null;
  display_name: string;
  role?: string;
};

export default function PublicProfilePage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewerIsStaff, setViewerIsStaff] = useState(false);
  const [softPlaces, setSoftPlaces] = useState<SoftSkillsPlacesView | null>(null);
  const [competencyDashboard, setCompetencyDashboard] = useState<SoftSkillsDashboardView | null>(
    null
  );
  const [softPlacesLoading, setSoftPlacesLoading] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.is_staff) setViewerIsStaff(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/players/${encodeURIComponent(username)}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setNotFound(true);
          return null;
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.profile) setProfile(data.profile);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!profile?.id || profile.role !== "student") return;
    let cancelled = false;
    setSoftPlacesLoading(true);
    fetch(`/api/soft-skills/users/${profile.id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        setSoftPlaces({
          leaguePlace: data.leaguePlace ?? null,
          classPlace: data.classPlace ?? null,
          teamPlace: data.teamPlace ?? null,
          overallPlace: data.overallPlace ?? null,
          overallPoints: data.overallPoints ?? 0,
          leagueLabel: data.leagueLabel ?? null,
          className: data.className ?? null,
          teamLabel: data.teamLabel ?? null,
        });
        setCompetencyDashboard({
          overall: data.competenciesOverall,
          byModule: data.competenciesByModule ?? {},
        });
      })
      .catch(() => {
        if (!cancelled) setSoftPlaces(null);
      })
      .finally(() => {
        if (!cancelled) setSoftPlacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role]);

  if (!username) {
    return (
      <main className="page-bg flex min-h-screen items-center justify-center">
        <p className="text-white/55">Укажите логин в адресе.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="page-bg flex min-h-screen items-center justify-center">
        <p className="text-white/55">Загрузка...</p>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="page-bg min-h-screen px-4 py-8">
        <div className="mx-auto max-w-md text-center">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/55 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
          <h1 className="font-display text-xl font-semibold text-white">Профиль не найден</h1>
          <p className="mt-2 text-white/55">Ученик с логином {username} не найден.</p>
        </div>
      </main>
    );
  }

  const displayName = profile.display_name || profile.username || "Ученик";

  if (profile.role !== "student") {
    return (
      <main className="page-bg min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
          <div className="surface p-6">
            <h1 className="font-display text-xl font-semibold text-white">{displayName}</h1>
            {profile.username && (
              <p className="mt-1 text-sm text-white/45">@{profile.username}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {viewerIsStaff && (
          <Link
            href="/profile"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            К списку учеников
          </Link>
        )}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        <SoftSkillsProfileSection
          displayName={displayName}
          username={profile.username}
          softPlaces={softPlaces}
          competencyDashboard={competencyDashboard}
          loading={softPlacesLoading}
        />
      </div>
    </main>
  );
}
