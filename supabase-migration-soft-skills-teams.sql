-- Soft Skills team memberships (module + league + team + student).
-- Run in Supabase → SQL Editor → Run.

create table if not exists public.soft_skills_team_members (
  id uuid primary key default gen_random_uuid(),
  module_id text not null,
  league_id text not null,
  team_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint soft_skills_team_members_module_check
    check (module_id in ('1','2','3','4','5','6')),
  constraint soft_skills_team_members_league_check
    check (league_id in ('1','2','3','4')),
  unique (module_id, league_id, team_id, user_id)
);

-- One team per module for each student
create unique index if not exists soft_skills_team_members_one_team_per_module
  on public.soft_skills_team_members (module_id, user_id);

create index if not exists soft_skills_team_members_lookup_idx
  on public.soft_skills_team_members (module_id, league_id, team_id);

create index if not exists soft_skills_team_members_user_idx
  on public.soft_skills_team_members (user_id);

alter table public.soft_skills_team_members enable row level security;

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

drop policy if exists soft_skills_team_members_select_staff on public.soft_skills_team_members;
create policy soft_skills_team_members_select_staff
  on public.soft_skills_team_members for select
  to authenticated
  using (public.is_teacher_or_admin() or auth.uid() = user_id);

drop policy if exists soft_skills_team_members_insert_staff on public.soft_skills_team_members;
create policy soft_skills_team_members_insert_staff
  on public.soft_skills_team_members for insert
  to authenticated
  with check (public.is_teacher_or_admin());

drop policy if exists soft_skills_team_members_update_staff on public.soft_skills_team_members;
create policy soft_skills_team_members_update_staff
  on public.soft_skills_team_members for update
  to authenticated
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

drop policy if exists soft_skills_team_members_delete_staff on public.soft_skills_team_members;
create policy soft_skills_team_members_delete_staff
  on public.soft_skills_team_members for delete
  to authenticated
  using (public.is_teacher_or_admin());
