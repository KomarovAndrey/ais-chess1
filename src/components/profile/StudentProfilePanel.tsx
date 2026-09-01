"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SoftSkillsProfileSection, {
  type SoftSkillsDashboardView,
  type SoftSkillsPlacesView,
} from "@/components/soft-skills/SoftSkillsProfileSection";
import { mapSoftSkillsApiResponse } from "@/lib/softSkillsProfileApi";

export default function StudentProfilePanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [softPlaces, setSoftPlaces] = useState<SoftSkillsPlacesView | null>(null);
  const [competencyDashboard, setCompetencyDashboard] = useState<SoftSkillsDashboardView | null>(
    null
  );
  const [softPlacesLoading, setSoftPlacesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setUsername(data.username ?? null);
        setUserId(data.id ?? null);
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setLoading(false);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    setSoftPlacesLoading(true);
    fetch("/api/soft-skills/me")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const mapped = mapSoftSkillsApiResponse(data);
        setSoftPlaces(mapped.softPlaces);
        setCompetencyDashboard(mapped.competencyDashboard);
      })
      .catch(() => setSoftPlaces(null))
      .finally(() => setSoftPlacesLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          bio: bio.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Не удалось сохранить");
      }
      const data = await res.json();
      setDisplayName(data.display_name ?? displayName.trim());
      setBio(data.bio ?? bio.trim());
      setMessage({ type: "ok", text: "Изменения сохранены." });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка сохранения.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page-bg flex min-h-screen items-center justify-center">
        <p className="text-white/55">Загрузка...</p>
      </main>
    );
  }

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

        <SoftSkillsProfileSection
          displayName={displayName.trim() || username || "Профиль"}
          username={username}
          userId={userId}
          isOwnProfile
          softPlaces={softPlaces}
          competencyDashboard={competencyDashboard}
          loading={softPlacesLoading}
        />

        <div className="mt-6 surface p-6">
          <button
            type="button"
            onClick={() => setShowEdit((v) => !v)}
            className="text-sm font-medium text-gold hover:text-gold-bright"
          >
            {showEdit ? "Скрыть редактирование" : "Редактировать профиль"}
          </button>

          {showEdit && (
            <form onSubmit={handleSubmit} className="mt-4 space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="display_name" className="text-sm font-medium text-white/70">
                  Имя
                </label>
                <input
                  id="display_name"
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                  placeholder="Введите имя"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="bio" className="text-sm font-medium text-white/70">
                  О себе
                </label>
                <textarea
                  id="bio"
                  rows={4}
                  maxLength={2000}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                  placeholder="Расскажите о себе..."
                />
                <p className="text-xs text-white/40">{bio.length} / 2000</p>
              </div>
              {message && (
                <p
                  className={`rounded-xl px-3 py-2 text-sm ${
                    message.type === "ok"
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {message.text}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
