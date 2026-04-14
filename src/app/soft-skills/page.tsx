"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ACTIVE_WEEK_STORAGE_KEY,
  DEFAULT_ACTIVE_WEEK,
  MAX_ACTIVE_WEEK,
  MIN_ACTIVE_WEEK,
  normalizeWeekNumber,
} from "@/lib/weekly";
import { Star, Download, CheckCircle } from "lucide-react";

interface Profile {
  id: string;
  username: string | null;
  email: string;
}

interface Ratings {
  leadership: string;
  communication: string;
  self_reflection: string;
  critical_thinking: string;
  self_control: string;
}

const COMPETENCIES = [
  { key: "leadership", label: "Лидерство" },
  { key: "communication", label: "Коммуникация" },
  { key: "self_reflection", label: "Саморефлексия" },
  { key: "critical_thinking", label: "Критическое мышление" },
  { key: "self_control", label: "Самоконтроль" },
] as const;

export default function SoftSkillsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [activeWeek, setActiveWeek] = useState(DEFAULT_ACTIVE_WEEK);
  const [ratings, setRatings] = useState<Ratings>({
    leadership: "-",
    communication: "-",
    self_reflection: "-",
    critical_thinking: "-",
    self_control: "-",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setActiveWeek(normalizeWeekNumber(window.localStorage.getItem(ACTIVE_WEEK_STORAGE_KEY)));
      } catch {
        setActiveWeek(DEFAULT_ACTIVE_WEEK);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage({ type: "error", text: "Необходимо войти в систему" });
        setLoading(false);
        return;
      }
      setCurrentUser(user);

      // Проверить роль
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || !["teacher", "admin"].includes(profile.role)) {
        setMessage({ type: "error", text: "Доступ запрещён. Только учителя и администраторы могут оценивать." });
        setLoading(false);
        return;
      }

      setUserRole(profile.role);

      // Загрузить список всех пользователей
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, username, email")
        .order("username", { ascending: true });

      setStudents(allProfiles || []);
      setLoading(false);
    }

    init();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_WEEK_STORAGE_KEY, String(activeWeek));
    } catch {
      // ignore storage issues
    }
  }, [activeWeek]);

  useEffect(() => {
    async function loadExistingRating() {
      if (!selectedStudent) {
        setRatings({
          leadership: "-",
          communication: "-",
          self_reflection: "-",
          critical_thinking: "-",
          self_control: "-",
        });
        return;
      }

      setLoadingRatings(true);
      try {
        const res = await fetch(`/api/soft-skills/ratings?week=${activeWeek}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Ошибка загрузки оценок");

        const list = Array.isArray(data?.ratings) ? data.ratings : [];
        const current = list.find((item: any) => item.student_id === selectedStudent);

        setRatings({
          leadership: current?.leadership || "-",
          communication: current?.communication || "-",
          self_reflection: current?.self_reflection || "-",
          critical_thinking: current?.critical_thinking || "-",
          self_control: current?.self_control || "-",
        });
      } catch (e: any) {
        setMessage({ type: "error", text: e.message || "Ошибка загрузки оценок" });
      } finally {
        setLoadingRatings(false);
      }
    }

    loadExistingRating();
  }, [selectedStudent, activeWeek]);

  function handleStarClick(competency: keyof Ratings, star: number) {
    setRatings((prev) => ({
      ...prev,
      [competency]: prev[competency] === String(star) ? "-" : String(star),
    }));
  }

  async function handleSave() {
    if (!selectedStudent) {
      setMessage({ type: "error", text: "Выберите участника для оценки" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/soft-skills/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudent,
          week_number: activeWeek,
          ...ratings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }

      setMessage({ type: "success", text: "Оценка успешно сохранена!" });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/soft-skills/export?week=${activeWeek}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка экспорта");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `soft-skills-week-${activeWeek}-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setExporting(false);
    }
  }

  function goToNextWeek() {
    setActiveWeek((prev) => Math.min(MAX_ACTIVE_WEEK, prev + 1));
    setMessage(null);
  }

  function goToPreviousWeek() {
    setActiveWeek((prev) => Math.max(MIN_ACTIVE_WEEK, prev - 1));
    setMessage(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50 px-4 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-slate-600">Загрузка...</p>
        </div>
      </main>
    );
  }

  if (!userRole || !["teacher", "admin"].includes(userRole)) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50 px-4 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-red-600">{message?.text || "Доступ запрещён"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Оценка Soft Skills</h1>
            <p className="mt-1 text-sm text-slate-600">Активная неделя: {activeWeek}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm">
              Неделя {activeWeek}
            </div>
            <button
              type="button"
              onClick={goToPreviousWeek}
              disabled={activeWeek <= MIN_ACTIVE_WEEK}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Предыдущая неделя
            </button>
            <button
              type="button"
              onClick={goToNextWeek}
              disabled={activeWeek >= MAX_ACTIVE_WEEK}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Следующая неделя
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl border border-green-600 bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Загрузка..." : "Скачать Excel"}
            </button>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-md md:p-8">
          {/* Student selection */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Выберите участника для оценки
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Выберите участника --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.username || s.email}
                </option>
              ))}
            </select>
          </div>

          {/* Ratings */}
          {selectedStudent && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Компетенции за неделю {activeWeek}
              </h2>

              {loadingRatings ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  Загрузка оценок недели...
                </div>
              ) : (
                COMPETENCIES.map((comp) => (
                <div key={comp.key} className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">{comp.label}</p>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const currentValue = Number(ratings[comp.key] || 0);
                      const isSelected = currentValue >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setRatings((prev) => ({
                              ...prev,
                              [comp.key]: currentValue === star ? "-" : String(star),
                            }))
                          }
                          className="transition hover:scale-110"
                        >
                          <Star
                            className={`h-8 w-8 ${
                              isSelected
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-slate-200 text-slate-300"
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="ml-3 text-sm text-slate-500">
                      {ratings[comp.key] === "-" ? "Не оценено" : `${ratings[comp.key]} из 5`}
                    </span>
                  </div>
                </div>
                ))
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loadingRatings}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-blue-500 disabled:opacity-60"
              >
                <CheckCircle className="h-5 w-5" />
                {saving ? "Сохранение..." : "Сохранить оценку"}
              </button>
            </div>
          )}

          {/* Message */}
          {message && (
            <div
              className={`mt-6 rounded-xl p-4 text-center text-sm font-medium ${
                message.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
