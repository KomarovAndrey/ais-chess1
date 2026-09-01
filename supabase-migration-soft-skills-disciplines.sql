-- Soft Skills: weekly discipline entries (Lumo, Robo, Sport, 3D) + star ratings.
-- Run AFTER soft_skills_scores migration.

create table if not exists public.soft_skills_discipline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  week_number integer not null,
  discipline text not null,
  outcome text,
  result_value text,
  error_count integer not null default 0,
  time_value text,
  team_time text,
  personal_time text,
  goals_count integer not null default 0,
  sport_error_count integer not null default 0,
  star_leadership smallint not null default 0,
  star_communication smallint not null default 0,
  star_self_reflection smallint not null default 0,
  star_critical_thinking smallint not null default 0,
  star_self_control smallint not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint soft_skills_discipline_entries_module_check
    check (module_id in ('1','2','3','4','5','6')),
  constraint soft_skills_discipline_entries_week_check
    check (week_number >= 1 and week_number <= 12),
  constraint soft_skills_discipline_entries_discipline_check
    check (discipline in ('lumo', 'robo', 'sport', '3d')),
  constraint soft_skills_discipline_entries_outcome_check
    check (outcome is null or outcome in ('win', 'lose')),
  constraint soft_skills_discipline_entries_stars_check
    check (
      star_leadership between 0 and 5
      and star_communication between 0 and 5
      and star_self_reflection between 0 and 5
      and star_critical_thinking between 0 and 5
      and star_self_control between 0 and 5
    ),
  unique (user_id, module_id, week_number, discipline)
);

create index if not exists soft_skills_discipline_entries_lookup_idx
  on public.soft_skills_discipline_entries (module_id, week_number, user_id);

alter table public.soft_skills_discipline_entries enable row level security;

drop policy if exists soft_skills_discipline_entries_select_all
  on public.soft_skills_discipline_entries;
create policy soft_skills_discipline_entries_select_all
  on public.soft_skills_discipline_entries for select
  to authenticated
  using (true);

drop policy if exists soft_skills_discipline_entries_write_staff
  on public.soft_skills_discipline_entries;
create policy soft_skills_discipline_entries_write_staff
  on public.soft_skills_discipline_entries for all
  to authenticated
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());
