-- Soft Skills: school class + weekly/module scores for ratings.
-- Run AFTER soft_skills_team_members + league binding migrations.

alter table public.profiles
  add column if not exists class_name text;

comment on column public.profiles.class_name is
  'School class, e.g. 5А, 6Б — used for Soft Skills class leaderboard.';

create index if not exists profiles_class_name_idx
  on public.profiles (class_name)
  where class_name is not null;

alter table public.profiles
  add column if not exists soft_skills_league_id text;

alter table public.profiles
  drop constraint if exists profiles_soft_skills_league_id_check;

alter table public.profiles
  add constraint profiles_soft_skills_league_id_check
  check (
    soft_skills_league_id is null
    or soft_skills_league_id in ('1', '2', '3', '4')
  );

-- Points per child per module week (sum → module total; all modules → overall)
create table if not exists public.soft_skills_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  week_number integer not null,
  points numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint soft_skills_scores_module_check
    check (module_id in ('1','2','3','4','5','6')),
  constraint soft_skills_scores_week_check
    check (week_number >= 1 and week_number <= 12),
  constraint soft_skills_scores_points_check
    check (points >= 0),
  unique (user_id, module_id, week_number)
);

create index if not exists soft_skills_scores_user_idx
  on public.soft_skills_scores (user_id);

create index if not exists soft_skills_scores_module_idx
  on public.soft_skills_scores (module_id);

alter table public.soft_skills_scores enable row level security;

create or replace function public.is_teacher_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('teacher', 'admin')
  );
$$;

drop policy if exists soft_skills_scores_select_all on public.soft_skills_scores;
create policy soft_skills_scores_select_all
  on public.soft_skills_scores for select
  to authenticated, anon
  using (true);

drop policy if exists soft_skills_scores_write_staff on public.soft_skills_scores;
create policy soft_skills_scores_write_staff
  on public.soft_skills_scores for all
  to authenticated
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());
