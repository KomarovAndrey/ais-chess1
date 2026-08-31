-- Soft Skills: child bound to one league; one team per module.
-- Run in Supabase → SQL Editor → Run.

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

comment on column public.profiles.soft_skills_league_id is
  'Soft Skills league binding: child appears only in this league.';

-- One team per module (not per league)
drop index if exists soft_skills_team_members_one_team_per_league;

create unique index if not exists soft_skills_team_members_one_team_per_module
  on public.soft_skills_team_members (module_id, user_id);

-- Backfill league from existing team memberships (latest row wins)
update public.profiles p
set soft_skills_league_id = m.league_id
from (
  select distinct on (user_id) user_id, league_id
  from public.soft_skills_team_members
  order by user_id, updated_at desc
) m
where p.id = m.user_id
  and p.soft_skills_league_id is null;
