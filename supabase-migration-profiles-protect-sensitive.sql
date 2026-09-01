-- Protect sensitive profile columns from self-service updates.
-- Run in Supabase SQL Editor after profiles.role and rating columns exist.

create or replace function public.profiles_guard_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into v_is_admin;

  if coalesce(v_is_admin, false) then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Cannot change role';
  end if;

  if new.rating is distinct from old.rating
    or new.rating_bullet is distinct from old.rating_bullet
    or new.rating_blitz is distinct from old.rating_blitz
    or new.rating_rapid is distinct from old.rating_rapid
    or new.games_played_bullet is distinct from old.games_played_bullet
    or new.games_played_blitz is distinct from old.games_played_blitz
    or new.games_played_rapid is distinct from old.games_played_rapid
  then
    raise exception 'Cannot change ratings';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_sensitive_columns on public.profiles;
create trigger profiles_guard_sensitive_columns
  before update on public.profiles
  for each row
  execute function public.profiles_guard_sensitive_columns();

-- Login email lookup: server-side only (no anon enumeration).
revoke all on function public.resolve_login_email(text) from public;
revoke all on function public.resolve_login_email(text) from anon;
revoke all on function public.resolve_login_email(text) from authenticated;
grant execute on function public.resolve_login_email(text) to service_role;

-- Authenticated users may read team rosters (module pages).
drop policy if exists soft_skills_team_members_select_roster on public.soft_skills_team_members;
create policy soft_skills_team_members_select_roster
  on public.soft_skills_team_members for select
  to authenticated
  using (true);
