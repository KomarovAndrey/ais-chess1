"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ACTIVE_WEEK_STORAGE_KEY,
  DEFAULT_ACTIVE_WEEK,
  MAX_ACTIVE_WEEK,
  MIN_ACTIVE_WEEK,
  normalizeWeekNumber,
} from "@/lib/weekly";
import {
  Download,
  RefreshCw,
  Upload,
  Pencil,
  Trash2,
  X,
  Check,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type ProgramRating = {
  id: string;
  week_number: number;
  program: ProgramName;
  leadership: string;
  communication: string;
  self_reflection: string;
  critical_thinking: string;
  self_control: string;
  sport_result?: "win" | "lose" | null;
  sport_goals?: number;
  sport_errors?: number;
  queue_order?: number | null;
  lumo_numeric_result?: number | null;
  lumo_errors?: number;
  robo_duration_text?: string | null;
  d3_team_time?: string | null;
  d3_participant_time?: string | null;
  program_comment?: string | null;
};

type ChildRow = {
  id: string;
  created_at: string;
  team_name: string | null;
  full_name: string;
  class_name: string | null;
  child_program_ratings?: ProgramRating[];
};

type GroupedRows = {
  teamKey: string;
  teamName: string;
  children: ChildRow[];
};

type SectionRows = {
  sectionKey: string;
  sectionLabel: string;
  teams: GroupedRows[];
};

type ProgramName = "Robo" | "Lumo" | "Sport" | "3D";
type RatingMetricKey =
  | "leadership"
  | "communication"
  | "self_reflection"
  | "critical_thinking"
  | "self_control";
type ProgramRatingsDraft = Record<RatingMetricKey, string> & {
  sport_result: "win" | "lose" | null;
  sport_goals: number;
  sport_errors: number;
  queue_order: number | null;
  lumo_numeric_text: string;
  lumo_errors: number;
  robo_duration_text: string;
  d3_team_time: string;
  d3_participant_time: string;
  program_comment: string;
};

const GRADE_SECTIONS = [
  { key: "kg1-g1", label: "KG1-G1" },
  { key: "g2-g3", label: "G2-G3" },
  { key: "g4-g6", label: "G4-G6" },
  { key: "g7-g10", label: "G7-G10" },
] as const;

const EXTRA_SECTION = { key: "other", label: "Без группы" } as const;
const COLLAPSE_STATE_STORAGE_KEY = "children-page-collapse-state";
const PROGRAMS: ProgramName[] = ["Lumo", "Robo", "Sport", "3D"];
const RATING_METRICS: { key: RatingMetricKey; label: string }[] = [
  { key: "leadership", label: "Лидер" },
  { key: "communication", label: "Коммун" },
  { key: "self_reflection", label: "Самореф" },
  { key: "critical_thinking", label: "Крит мыш" },
  { key: "self_control", label: "Самокн" },
];
const QUEUE_OPTIONS_LUMO = [1, 2, 3, 4, 5];
const QUEUE_OPTIONS_ROBO = [1, 2, 3, 4, 5, 6, 7];

function emptyProgramRatings(): ProgramRatingsDraft {
  return {
    leadership: "-",
    communication: "-",
    self_reflection: "-",
    critical_thinking: "-",
    self_control: "-",
    sport_result: null,
    sport_goals: 0,
    sport_errors: 0,
    queue_order: null,
    lumo_numeric_text: "",
    lumo_errors: 0,
    robo_duration_text: "",
    d3_team_time: "",
    d3_participant_time: "",
    program_comment: "",
  };
}

function draftFromRating(existing: ProgramRating | null | undefined): ProgramRatingsDraft {
  if (!existing) return emptyProgramRatings();
  return {
    leadership: existing.leadership,
    communication: existing.communication,
    self_reflection: existing.self_reflection,
    critical_thinking: existing.critical_thinking,
    self_control: existing.self_control,
    sport_result: existing.sport_result ?? null,
    sport_goals: existing.sport_goals ?? 0,
    sport_errors: existing.sport_errors ?? 0,
    queue_order:
      existing.queue_order !== null && existing.queue_order !== undefined && Number.isFinite(Number(existing.queue_order))
        ? Math.trunc(Number(existing.queue_order))
        : null,
    lumo_numeric_text:
      existing.lumo_numeric_result !== null && existing.lumo_numeric_result !== undefined
        ? String(existing.lumo_numeric_result)
        : "",
    lumo_errors: existing.lumo_errors ?? 0,
    robo_duration_text: existing.robo_duration_text ?? "",
    d3_team_time: existing.d3_team_time ?? "",
    d3_participant_time: existing.d3_participant_time ?? "",
    program_comment: existing.program_comment ?? "",
  };
}

function draftToApiBody(draft: ProgramRatingsDraft) {
  const lumoTrim = draft.lumo_numeric_text.trim();
  return {
    leadership: draft.leadership,
    communication: draft.communication,
    self_reflection: draft.self_reflection,
    critical_thinking: draft.critical_thinking,
    self_control: draft.self_control,
    sport_result: draft.sport_result,
    sport_goals: draft.sport_goals,
    sport_errors: draft.sport_errors,
    queue_order: draft.queue_order,
    lumo_numeric_result: lumoTrim === "" ? null : Number(lumoTrim),
    lumo_errors: draft.lumo_errors,
    robo_duration_text: draft.robo_duration_text.trim() || null,
    d3_team_time: draft.d3_team_time.trim() || null,
    d3_participant_time: draft.d3_participant_time.trim() || null,
    program_comment: draft.program_comment.trim() || null,
  };
}

function normalizeClassName(value?: string | null) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

function getSectionKey(className?: string | null) {
  const normalized = normalizeClassName(className);

  if (!normalized) return EXTRA_SECTION.key;
  if (normalized.startsWith("KG") || normalized.startsWith("G1") || /^1/.test(normalized)) {
    return "kg1-g1";
  }
  if (normalized.startsWith("G2") || normalized.startsWith("G3") || /^[23]/.test(normalized)) {
    return "g2-g3";
  }
  if (
    normalized.startsWith("G4") ||
    normalized.startsWith("G5") ||
    normalized.startsWith("G6") ||
    /^[456]/.test(normalized)
  ) {
    return "g4-g6";
  }
  if (
    normalized.startsWith("G7") ||
    normalized.startsWith("G8") ||
    normalized.startsWith("G9") ||
    normalized.startsWith("G10") ||
    /^7/.test(normalized) ||
    /^8/.test(normalized) ||
    /^9/.test(normalized) ||
    /^10/.test(normalized)
  ) {
    return "g7-g10";
  }

  return EXTRA_SECTION.key;
}

function programsForSection(sectionKey: string): ProgramName[] {
  if (sectionKey === "g7-g10") return ["Sport"];
  return PROGRAMS;
}

export default function ChildrenCommentsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChildRow[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newChildTeam, setNewChildTeam] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newChildClass, setNewChildClass] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTeam, setEditTeam] = useState("");
  const [editName, setEditName] = useState("");
  const [editClass, setEditClass] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [activeWeek, setActiveWeek] = useState(DEFAULT_ACTIVE_WEEK);
  const [selectedProgramByChild, setSelectedProgramByChild] = useState<Record<string, ProgramName>>({});
  const [programRatingsDrafts, setProgramRatingsDrafts] = useState<Record<string, ProgramRatingsDraft>>({});
  const [savingProgramKey, setSavingProgramKey] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});
  const [collapsedChildren, setCollapsedChildren] = useState<Record<string, boolean>>({});
  const [collapseStateReady, setCollapseStateReady] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [(r.team_name ?? ""), (r.full_name ?? ""), (r.class_name ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const sectionedRows = useMemo<SectionRows[]>(() => {
    const sections = new Map<string, Map<string, ChildRow[]>>();
    for (const section of GRADE_SECTIONS) {
      sections.set(section.key, new Map());
    }
    sections.set(EXTRA_SECTION.key, new Map());

    for (const row of filtered) {
      const sectionKey = getSectionKey(row.class_name);
      const teamName = row.team_name?.trim() || "Без команды";
      const teamMap = sections.get(sectionKey) ?? new Map<string, ChildRow[]>();
      const list = teamMap.get(teamName) ?? [];
      list.push(row);
      teamMap.set(teamName, list);
      sections.set(sectionKey, teamMap);
    }

    const baseSections: SectionRows[] = GRADE_SECTIONS.map((section) => {
      const teamMap = sections.get(section.key) ?? new Map<string, ChildRow[]>();
      const teams = Array.from(teamMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, "ru"))
        .map(([teamName, children]) => ({
          teamKey: `${section.key}::${teamName}`,
          teamName,
          children: [...children].sort((a, b) => a.full_name.localeCompare(b.full_name, "ru")),
        }));

      return {
        sectionKey: section.key,
        sectionLabel: section.label,
        teams,
      };
    });

    const extraTeams = Array.from(sections.get(EXTRA_SECTION.key)?.entries() ?? [])
      .sort(([a], [b]) => a.localeCompare(b, "ru"))
      .map(([teamName, children]) => ({
        teamKey: `${EXTRA_SECTION.key}::${teamName}`,
        teamName,
        children: [...children].sort((a, b) => a.full_name.localeCompare(b.full_name, "ru")),
      }));

    if (extraTeams.length > 0) {
      baseSections.push({
        sectionKey: EXTRA_SECTION.key,
        sectionLabel: EXTRA_SECTION.label,
        teams: extraTeams,
      });
    }

    return baseSections;
  }, [filtered]);

  const load = useCallback(async (opts?: { preserveScroll?: boolean }) => {
    const preserveScroll = opts?.preserveScroll ?? false;
    const scrollY = preserveScroll ? window.scrollY : null;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/children/table?week=${activeWeek}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAllowed(res.status !== 403 ? null : false);
        throw new Error(data?.error || "Ошибка загрузки");
      }
      setAllowed(true);
      setRows(Array.isArray(data?.children) ? data.children : []);
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setLoading(false);

      if (scrollY !== null) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
        });
      }
    }
  }, [activeWeek]);

  useEffect(() => {
    // verify logged-in early for nicer message (API still enforces)
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) setAllowed(false);
    });
    try {
      setActiveWeek(normalizeWeekNumber(window.localStorage.getItem(ACTIVE_WEEK_STORAGE_KEY)));
    } catch {
      setActiveWeek(DEFAULT_ACTIVE_WEEK);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_WEEK_STORAGE_KEY, String(activeWeek));
    } catch {
      // ignore localStorage issues
    }
  }, [activeWeek]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSE_STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.sections && typeof parsed.sections === "object") {
          setCollapsedSections(parsed.sections as Record<string, boolean>);
        }
        if (parsed?.teams && typeof parsed.teams === "object") {
          setCollapsedTeams(parsed.teams as Record<string, boolean>);
        }
        if (parsed?.children && typeof parsed.children === "object") {
          setCollapsedChildren(parsed.children as Record<string, boolean>);
        }
      }
    } catch {
      // ignore broken localStorage payload and continue with defaults
    } finally {
      setCollapseStateReady(true);
    }
  }, []);

  useEffect(() => {
    if (!collapseStateReady) return;

    setCollapsedSections((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { sectionKey } of sectionedRows) {
        if (!(sectionKey in next)) {
          next[sectionKey] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setCollapsedTeams((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const section of sectionedRows) {
        for (const { teamKey } of section.teams) {
          if (!(teamKey in next)) {
            next[teamKey] = true;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });

    setCollapsedChildren((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const section of sectionedRows) {
        for (const { children } of section.teams) {
          for (const child of children) {
            if (!(child.id in next)) {
              next[child.id] = true;
              changed = true;
            }
          }
        }
      }
      return changed ? next : prev;
    });
  }, [collapseStateReady, sectionedRows]);

  useEffect(() => {
    if (!collapseStateReady) return;
    window.localStorage.setItem(
      COLLAPSE_STATE_STORAGE_KEY,
      JSON.stringify({
        sections: collapsedSections,
        teams: collapsedTeams,
        children: collapsedChildren,
      })
    );
  }, [collapseStateReady, collapsedSections, collapsedTeams, collapsedChildren]);

  // Realtime sync intentionally disabled (teachers should not be interrupted by other users' saves).

  async function addChild() {
    const team_name = newChildTeam.trim();
    const full_name = newChildName.trim();
    const class_name = newChildClass.trim();
    if (!full_name) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: team_name ? team_name : null,
          full_name,
          class_name: class_name ? class_name : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Ошибка добавления");
      setNewChildTeam("");
      setNewChildName("");
      setNewChildClass("");
      load();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setAdding(false);
    }
  }

  function downloadExcel() {
    window.location.href = `/api/children/export?week=${activeWeek}`;
  }

  function downloadExcelAllWeeks() {
    window.location.href = "/api/children/export";
  }

  function downloadTemplate() {
    window.location.href = "/api/children/template";
  }

  function toggleSection(sectionKey: string) {
    setCollapsedSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  }

  function toggleTeam(teamKey: string) {
    setCollapsedTeams((prev) => ({ ...prev, [teamKey]: !prev[teamKey] }));
  }

  function toggleChild(childId: string) {
    setCollapsedChildren((prev) => ({ ...prev, [childId]: !prev[childId] }));
  }

  async function saveEdit(childId: string) {
    const team_name = editTeam.trim();
    const full_name = editName.trim();
    const class_name = editClass.trim();
    if (!full_name) return;

    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/children/${encodeURIComponent(childId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: team_name ? team_name : null,
          full_name,
          class_name: class_name ? class_name : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Ошибка сохранения");
      setEditingId(null);
      setEditName("");
      setEditClass("");
      load();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteChild(childId: string) {
    if (!window.confirm("Удалить ребёнка?")) return;
    setDeletingId(childId);
    setError(null);
    try {
      const res = await fetch(`/api/children/${encodeURIComponent(childId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Ошибка удаления");
      load();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setDeletingId(null);
    }
  }

  async function importFromExcel() {
    if (!importFile) return;
    setImporting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await fetch("/api/children/import", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Ошибка импорта");
      setImportFile(null);
      load();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setImporting(false);
    }
  }

  function goToNextWeek() {
    setActiveWeek((prev) => Math.min(MAX_ACTIVE_WEEK, prev + 1));
  }

  function goToPreviousWeek() {
    setActiveWeek((prev) => Math.max(MIN_ACTIVE_WEEK, prev - 1));
  }

  function getSelectedProgram(childId: string, sectionKey: string): ProgramName {
    const available = programsForSection(sectionKey);
    const current = selectedProgramByChild[childId] ?? available[0] ?? "Sport";
    return available.includes(current) ? current : (available[0] ?? "Sport");
  }

  function getProgramDraftKey(childId: string, program: ProgramName) {
    return `${childId}::${program}::${activeWeek}`;
  }

  function selectProgram(childId: string, ratings: ProgramRating[] | undefined, program: ProgramName) {
    setSelectedProgramByChild((prev) => ({ ...prev, [childId]: program }));
    const existing = Array.isArray(ratings) ? ratings.find((item) => item.program === program) : null;
    setProgramRatingsDrafts((prev) => ({
      ...prev,
      [getProgramDraftKey(childId, program)]: draftFromRating(existing),
    }));
  }

  function updateProgramDraft(
    childId: string,
    program: ProgramName,
    ratings: ProgramRating[] | undefined,
    metric: RatingMetricKey,
    value: string
  ) {
    const draftKey = getProgramDraftKey(childId, program);
    const existing = Array.isArray(ratings) ? ratings.find((item) => item.program === program) : null;
    setProgramRatingsDrafts((prev) => ({
      ...prev,
      [draftKey]: {
        ...(prev[draftKey] ?? draftFromRating(existing)),
        [metric]: value,
      },
    }));
  }

  async function saveProgramRatings(childId: string, program: ProgramName) {
    const draftKey = getProgramDraftKey(childId, program);
    const draft = programRatingsDrafts[draftKey] ?? emptyProgramRatings();
    setSavingProgramKey(draftKey);
    setError(null);
    try {
      const res = await fetch("/api/children/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          child_id: childId,
          week_number: activeWeek,
          program,
          ...draftToApiBody(draft),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Ошибка сохранения оценки");
      if (data?.rating) {
        const savedRating = data.rating as ProgramRating;
        setRows((prev) =>
          prev.map((row) => {
            if (row.id !== childId) return row;

            const currentRatings = Array.isArray(row.child_program_ratings) ? row.child_program_ratings : [];
            const existingIndex = currentRatings.findIndex(
              (item) => item.program === savedRating.program && item.week_number === savedRating.week_number
            );

            if (existingIndex === -1) {
              return {
                ...row,
                child_program_ratings: [...currentRatings, savedRating],
              };
            }

            const nextRatings = [...currentRatings];
            nextRatings[existingIndex] = savedRating;

            return {
              ...row,
              child_program_ratings: nextRatings,
            };
          })
        );
      }
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setSavingProgramKey(null);
    }
  }

  if (allowed === false) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Soft Skills</h1>
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Доступ запрещён. Раздел доступен только пользователям с ролью teacher или admin.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Soft Skills</h1>
          <p className="mt-1 text-sm text-slate-600">
            Недели {MIN_ACTIVE_WEEK}–{MAX_ACTIVE_WEEK}. Оценки по программам общие для всех учителей: изменения синхронизируются между устройствами. Excel — одна выгрузка по всем неделям и детям (формат отчётной таблицы).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            Неделя {activeWeek}
          </div>
          <button
            type="button"
            onClick={goToPreviousWeek}
            disabled={activeWeek <= MIN_ACTIVE_WEEK}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Предыдущая неделя
          </button>
          <button
            type="button"
            onClick={goToNextWeek}
            disabled={activeWeek >= MAX_ACTIVE_WEEK}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Следующая неделя
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Обновить
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 shadow-sm hover:bg-emerald-100"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Скачать шаблон
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Upload className="h-4 w-4" aria-hidden />
            Импорт Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={importFromExcel}
            disabled={importing || !importFile}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? "Загрузка…" : "Загрузить"}
          </button>
          <button
            type="button"
            onClick={downloadExcel}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Download className="h-4 w-4" aria-hidden />
            Excel (неделя)
          </button>
          <button
            type="button"
            onClick={downloadExcelAllWeeks}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 shadow-sm hover:bg-blue-100"
          >
            <Download className="h-4 w-4" aria-hidden />
            Excel (все недели)
          </button>
        </div>
      </div>

      {importFile && (
        <p className="mt-3 text-sm text-slate-600">
          Выбран файл: <span className="font-medium text-slate-800">{importFile.name}</span>
        </p>
      )}

      <div className="mt-6 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по команде, имени или классу..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Добавить ребёнка</div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={newChildTeam}
            onChange={(e) => setNewChildTeam(e.target.value)}
            placeholder="Команда"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          />
          <input
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            placeholder="Имя ребёнка"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          />
          <input
            value={newChildClass}
            onChange={(e) => setNewChildClass(e.target.value)}
            placeholder="Класс / Grade"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          />
          <button
            type="button"
            onClick={addChild}
            disabled={adding || !newChildName.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? "Добавление…" : "Добавить"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Загрузка…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Нет совпадений.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {sectionedRows.map(({ sectionKey, sectionLabel, teams }) => {
            const sectionChildrenCount = teams.reduce((sum, team) => sum + team.children.length, 0);
            return (
              <section key={sectionKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-4 text-left hover:bg-slate-200/70"
                >
                  <div className="flex items-center gap-2">
                    {collapsedSections[sectionKey] ? (
                      <ChevronRight className="h-5 w-5 text-slate-500" aria-hidden />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-500" aria-hidden />
                    )}
                    <h2 className="text-xl font-semibold text-slate-900">{sectionLabel}</h2>
                  </div>
                  <span className="text-sm text-slate-500">{sectionChildrenCount} чел.</span>
                </button>

                {!collapsedSections[sectionKey] && (
                  <div className="space-y-4 bg-slate-50/60 p-4">
                    {teams.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                        В этом блоке пока нет детей.
                      </div>
                    ) : (
                      teams.map(({ teamKey, teamName, children }) => (
                        <section key={teamKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => toggleTeam(teamKey)}
                            className="flex w-full items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                          >
                            <div className="flex items-center gap-2">
                              {collapsedTeams[teamKey] ? (
                                <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
                              )}
                              <h3 className="text-lg font-semibold text-slate-900">{teamName}</h3>
                            </div>
                            <span className="text-sm text-slate-500">{children.length} чел.</span>
                          </button>
                          {!collapsedTeams[teamKey] && (
                            <div className="divide-y divide-slate-200">
                              {children.map((r) => {
                                const programRatings = Array.isArray(r.child_program_ratings) ? r.child_program_ratings : [];
                                const isEditing = editingId === r.id;
                                const isCollapsed = collapsedChildren[r.id] ?? false;
                                const selectedProgram = getSelectedProgram(r.id, sectionKey);
                                const selectedDraftKey = getProgramDraftKey(r.id, selectedProgram);
                                const selectedDraft =
                                  programRatingsDrafts[selectedDraftKey] ??
                                  draftFromRating(programRatings.find((item) => item.program === selectedProgram));
                                const availablePrograms = programsForSection(sectionKey);
                                const isG7toG10 = sectionKey === "g7-g10";
                                return (
                                  <article key={r.id} className="bg-white">
                                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                                      <button
                                        type="button"
                                        onClick={() => toggleChild(r.id)}
                                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                      >
                                        {isCollapsed ? (
                                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                                        ) : (
                                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                                        )}
                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold text-slate-900">{r.full_name}</div>
                                          <div className="mt-1 text-sm text-slate-600">
                                            Класс: {r.class_name || "—"}
                                          </div>
                                        </div>
                                      </button>
                                      {!isEditing && (
                                        <div className="inline-flex items-center gap-2 self-start">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingId(r.id);
                                              setEditTeam(r.team_name ?? "");
                                              setEditName(r.full_name);
                                              setEditClass(r.class_name ?? "");
                                              setCollapsedChildren((prev) => ({ ...prev, [r.id]: false }));
                                              setCollapsedTeams((prev) => ({ ...prev, [teamKey]: false }));
                                              setCollapsedSections((prev) => ({ ...prev, [sectionKey]: false }));
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                          >
                                            <Pencil className="h-4 w-4" aria-hidden />
                                            Правка
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => deleteChild(r.id)}
                                            disabled={deletingId === r.id}
                                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                                          >
                                            <Trash2 className="h-4 w-4" aria-hidden />
                                            {deletingId === r.id ? "Удаление…" : "Удалить"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    {!isCollapsed && (
                                      <div className="border-t border-slate-100 px-4 pb-4">
                                        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                                          <div className="space-y-3 pt-4">
                                            {isEditing ? (
                                              <>
                                                <input
                                                  value={editTeam}
                                                  onChange={(e) => setEditTeam(e.target.value)}
                                                  placeholder="Команда"
                                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                                                />
                                                <input
                                                  value={editName}
                                                  onChange={(e) => setEditName(e.target.value)}
                                                  placeholder="Имя"
                                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                                                />
                                                <input
                                                  value={editClass}
                                                  onChange={(e) => setEditClass(e.target.value)}
                                                  placeholder="Класс"
                                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                                                />
                                                <div className="inline-flex flex-wrap items-center gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => saveEdit(r.id)}
                                                    disabled={savingEdit || !editName.trim()}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                                                  >
                                                    <Check className="h-4 w-4" aria-hidden />
                                                    Сохранить
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingId(null);
                                                      setEditTeam("");
                                                      setEditName("");
                                                      setEditClass("");
                                                    }}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                  >
                                                    <X className="h-4 w-4" aria-hidden />
                                                    Отмена
                                                  </button>
                                                </div>
                                              </>
                                            ) : (
                                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                                <div>
                                                  <span className="font-medium text-slate-900">Команда:</span>{" "}
                                                  {r.team_name || "Без команды"}
                                                </div>
                                                <div className="mt-2">
                                                  <span className="font-medium text-slate-900">Класс:</span>{" "}
                                                  {r.class_name || "—"}
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          <div className="space-y-4 pt-4">
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                              <div className="flex flex-wrap gap-2">
                                                {availablePrograms.map((program) => (
                                                  <button
                                                    key={program}
                                                    type="button"
                                                    onClick={() => selectProgram(r.id, programRatings, program)}
                                                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                                      selectedProgram === program
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-white text-slate-700 hover:bg-slate-100"
                                                    }`}
                                                  >
                                                    {program}
                                                  </button>
                                                ))}
                                              </div>

                                              <div className="mt-4 overflow-x-auto">
                                                <table className="min-w-full text-sm">
                                                  <thead>
                                                    <tr className="text-left text-slate-600">
                                                      {RATING_METRICS.map((metric) => (
                                                        <th key={metric.key} className="pb-2 pr-3 font-medium">
                                                          {metric.label}
                                                        </th>
                                                      ))}
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    <tr>
                                                      {RATING_METRICS.map((metric) => (
                                                        <td key={metric.key} className="pr-3 align-top">
                                                          <div className="flex items-center gap-1">
                                                            {[1, 2, 3, 4, 5].map((star) => {
                                                              const value = String(star);
                                                              const currentValue = Number(selectedDraft[metric.key] || 0);
                                                              const selected = currentValue >= star;
                                                              return (
                                                                <button
                                                                  key={star}
                                                                  type="button"
                                                                  onClick={() =>
                                                                    updateProgramDraft(
                                                                      r.id,
                                                                      selectedProgram,
                                                                      programRatings,
                                                                      metric.key,
                                                                      currentValue === star ? "-" : value
                                                                    )
                                                                  }
                                                                  className={`text-xl leading-none transition ${
                                                                    selected ? "text-yellow-400" : "text-slate-300 hover:text-slate-400"
                                                                  }`}
                                                                >
                                                                  ★
                                                                </button>
                                                              );
                                                            })}
                                                          </div>
                                                        </td>
                                                      ))}
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </div>

                                              <div className="mt-4 flex flex-wrap items-center gap-3">
                                                <span className="text-sm font-medium text-slate-700">Win / Lose</span>
                                                <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setProgramRatingsDrafts((prev) => ({
                                                        ...prev,
                                                        [selectedDraftKey]: {
                                                          ...selectedDraft,
                                                          sport_result:
                                                            selectedDraft.sport_result === "win" ? null : "win",
                                                        },
                                                      }))
                                                    }
                                                    className={`px-3 py-1.5 text-sm font-medium ${
                                                      selectedDraft.sport_result === "win"
                                                        ? "bg-emerald-600 text-white"
                                                        : "text-slate-700 hover:bg-slate-50"
                                                    }`}
                                                  >
                                                    Win
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setProgramRatingsDrafts((prev) => ({
                                                        ...prev,
                                                        [selectedDraftKey]: {
                                                          ...selectedDraft,
                                                          sport_result:
                                                            selectedDraft.sport_result === "lose" ? null : "lose",
                                                        },
                                                      }))
                                                    }
                                                    className={`border-l border-slate-200 px-3 py-1.5 text-sm font-medium ${
                                                      selectedDraft.sport_result === "lose"
                                                        ? "bg-rose-600 text-white"
                                                        : "text-slate-700 hover:bg-slate-50"
                                                    }`}
                                                  >
                                                    Lose
                                                  </button>
                                                </div>
                                              </div>

                                              {selectedProgram === "Lumo" && (
                                                <div className="mt-4 space-y-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                                                  <div>
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`lumo-res-${selectedDraftKey}`}>
                                                      Результат (число)
                                                    </label>
                                                    <input
                                                      id={`lumo-res-${selectedDraftKey}`}
                                                      type="text"
                                                      inputMode="numeric"
                                                      value={selectedDraft.lumo_numeric_text}
                                                      onChange={(e) =>
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            lumo_numeric_text: e.target.value,
                                                          },
                                                        }))
                                                      }
                                                      className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                                                      placeholder="Напр. 11750"
                                                    />
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`queue-${selectedDraftKey}`}>
                                                      Очередность
                                                    </label>
                                                    <select
                                                      id={`queue-${selectedDraftKey}`}
                                                      value={
                                                        selectedDraft.queue_order === null || selectedDraft.queue_order === undefined
                                                          ? ""
                                                          : String(selectedDraft.queue_order)
                                                      }
                                                      onChange={(e) => {
                                                        const v = e.target.value;
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            queue_order: v === "" ? null : Math.trunc(Number(v)),
                                                          },
                                                        }));
                                                      }}
                                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm"
                                                    >
                                                      <option value="">—</option>
                                                      {QUEUE_OPTIONS_LUMO.map((n) => (
                                                        <option key={n} value={n}>
                                                          {n}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </div>
                                                  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                                                    <span className="text-sm font-medium text-slate-700">
                                                      Ошибки: {selectedDraft.lumo_errors}
                                                    </span>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            lumo_errors: Math.max(0, selectedDraft.lumo_errors + 1),
                                                          },
                                                        }))
                                                      }
                                                      className="rounded-md bg-blue-600 px-2 py-0.5 text-sm font-semibold text-white hover:bg-blue-700"
                                                    >
                                                      +
                                                    </button>
                                                  </div>
                                                  <div>
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`lumo-cm-${selectedDraftKey}`}>
                                                      Комментарий
                                                    </label>
                                                    <textarea
                                                      id={`lumo-cm-${selectedDraftKey}`}
                                                      value={selectedDraft.program_comment}
                                                      onChange={(e) =>
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            program_comment: e.target.value,
                                                          },
                                                        }))
                                                      }
                                                      rows={2}
                                                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                                                      placeholder="Комментарий по Lumo за неделю"
                                                    />
                                                  </div>
                                                </div>
                                              )}

                                              {selectedProgram === "Robo" && (
                                                <div className="mt-4 space-y-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                                                  <div>
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`robo-t-${selectedDraftKey}`}>
                                                      Время
                                                    </label>
                                                    <input
                                                      id={`robo-t-${selectedDraftKey}`}
                                                      type="text"
                                                      value={selectedDraft.robo_duration_text}
                                                      onChange={(e) =>
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            robo_duration_text: e.target.value,
                                                          },
                                                        }))
                                                      }
                                                      className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                                                      placeholder="Напр. 5:00 или 1:25"
                                                    />
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`queue-r-${selectedDraftKey}`}>
                                                      Очередность
                                                    </label>
                                                    <select
                                                      id={`queue-r-${selectedDraftKey}`}
                                                      value={
                                                        selectedDraft.queue_order === null || selectedDraft.queue_order === undefined
                                                          ? ""
                                                          : String(selectedDraft.queue_order)
                                                      }
                                                      onChange={(e) => {
                                                        const v = e.target.value;
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            queue_order: v === "" ? null : Math.trunc(Number(v)),
                                                          },
                                                        }));
                                                      }}
                                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm"
                                                    >
                                                      <option value="">—</option>
                                                      {QUEUE_OPTIONS_ROBO.map((n) => (
                                                        <option key={n} value={n}>
                                                          {n}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`robo-cm-${selectedDraftKey}`}>
                                                      Комментарий
                                                    </label>
                                                    <textarea
                                                      id={`robo-cm-${selectedDraftKey}`}
                                                      value={selectedDraft.program_comment}
                                                      onChange={(e) =>
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            program_comment: e.target.value,
                                                          },
                                                        }))
                                                      }
                                                      rows={2}
                                                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                                                      placeholder="Комментарий по Robo за неделю"
                                                    />
                                                  </div>
                                                </div>
                                              )}

                                              {selectedProgram === "Sport" && (
                                                !isG7toG10 && (
                                                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">
                                                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                                                      <span className="text-sm font-medium text-slate-700">
                                                        Голы: {selectedDraft.sport_goals}
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setProgramRatingsDrafts((prev) => ({
                                                            ...prev,
                                                            [selectedDraftKey]: {
                                                              ...selectedDraft,
                                                              sport_goals: Math.max(0, selectedDraft.sport_goals + 1),
                                                            },
                                                          }))
                                                        }
                                                        className="rounded-md bg-blue-600 px-2 py-0.5 text-sm font-semibold text-white hover:bg-blue-700"
                                                      >
                                                        +
                                                      </button>
                                                    </div>
                                                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                                                      <span className="text-sm font-medium text-slate-700">
                                                        Ошибки: {selectedDraft.sport_errors}
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setProgramRatingsDrafts((prev) => ({
                                                            ...prev,
                                                            [selectedDraftKey]: {
                                                              ...selectedDraft,
                                                              sport_errors: Math.max(0, selectedDraft.sport_errors + 1),
                                                            },
                                                          }))
                                                        }
                                                        className="rounded-md bg-blue-600 px-2 py-0.5 text-sm font-semibold text-white hover:bg-blue-700"
                                                      >
                                                        +
                                                      </button>
                                                    </div>
                                                    <div className="w-full min-w-[200px] flex-1">
                                                      <label
                                                        className="text-sm font-medium text-slate-700"
                                                        htmlFor={`sport-cm-${selectedDraftKey}`}
                                                      >
                                                        Комментарий
                                                      </label>
                                                      <textarea
                                                        id={`sport-cm-${selectedDraftKey}`}
                                                        value={selectedDraft.program_comment}
                                                        onChange={(e) =>
                                                          setProgramRatingsDrafts((prev) => ({
                                                            ...prev,
                                                            [selectedDraftKey]: {
                                                              ...selectedDraft,
                                                              program_comment: e.target.value,
                                                            },
                                                          }))
                                                        }
                                                        rows={2}
                                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                                                        placeholder="Комментарий по спорту за неделю"
                                                      />
                                                    </div>
                                                  </div>
                                                )
                                              )}

                                              {selectedProgram === "3D" && (
                                                <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                                                  <div>
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`d3-team-${selectedDraftKey}`}>
                                                      Время команды
                                                    </label>
                                                    <input
                                                      id={`d3-team-${selectedDraftKey}`}
                                                      type="text"
                                                      value={selectedDraft.d3_team_time}
                                                      onChange={(e) =>
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            d3_team_time: e.target.value,
                                                          },
                                                        }))
                                                      }
                                                      className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                                                      placeholder="Напр. 3:50"
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`d3-part-${selectedDraftKey}`}>
                                                      Время участника
                                                    </label>
                                                    <input
                                                      id={`d3-part-${selectedDraftKey}`}
                                                      type="text"
                                                      value={selectedDraft.d3_participant_time}
                                                      onChange={(e) =>
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            d3_participant_time: e.target.value,
                                                          },
                                                        }))
                                                      }
                                                      className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                                                      placeholder="—"
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="text-sm font-medium text-slate-700" htmlFor={`d3-cm-${selectedDraftKey}`}>
                                                      Комментарий
                                                    </label>
                                                    <textarea
                                                      id={`d3-cm-${selectedDraftKey}`}
                                                      value={selectedDraft.program_comment}
                                                      onChange={(e) =>
                                                        setProgramRatingsDrafts((prev) => ({
                                                          ...prev,
                                                          [selectedDraftKey]: {
                                                            ...selectedDraft,
                                                            program_comment: e.target.value,
                                                          },
                                                        }))
                                                      }
                                                      rows={2}
                                                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
                                                      placeholder="Комментарий по 3D за неделю"
                                                    />
                                                  </div>
                                                </div>
                                              )}

                                              <div className="mt-4 flex justify-end">
                                                <button
                                                  type="button"
                                                  onClick={() => saveProgramRatings(r.id, selectedProgram)}
                                                  disabled={savingProgramKey === selectedDraftKey}
                                                  className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                                                >
                                                  {savingProgramKey === selectedDraftKey ? "Сохранение…" : "Оценить"}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </article>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      ))
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

