-- Phase E: Arena tournaments (live pairing via seeks + standings)
-- Run AFTER matchmaking-phase-a.sql

-- 1) Extend tournaments
alter table public.tournaments
  add column if not exists time_control_seconds integer not null default 300;

alter table public.tournaments
  add column if not exists increment_seconds integer not null default 0;

alter table public.tournaments
  add column if not exists rated boolean not null default true;

alter table public.tournaments
  add column if not exists ends_at timestamptz;

alter table public.tournaments
  add column if not exists duration_minutes integer not null default 60;

-- Allow format = arena
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.tournaments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%format%';
  if cname is not null then
    execute format('alter table public.tournaments drop constraint %I', cname);
  end if;
end $$;

alter table public.tournaments
  add constraint tournaments_format_check
  check (format in ('round_robin', 'swiss', 'arena'));

alter table public.tournaments
  alter column format set default 'arena';

-- 2) Player scores
alter table public.tournament_players
  add column if not exists score numeric not null default 0;

alter table public.tournament_players
  add column if not exists games_played integer not null default 0;

alter table public.tournament_players
  add column if not exists withdrawn boolean not null default false;

-- 3) Link games + seeks to tournament
alter table public.games
  add column if not exists tournament_id uuid references public.tournaments(id) on delete set null;

create index if not exists games_tournament_id_idx
  on public.games (tournament_id)
  where tournament_id is not null;

alter table public.game_seeks
  add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;

drop index if exists game_seeks_one_pending_per_user;
create unique index if not exists game_seeks_one_pending_per_user_lobby
  on public.game_seeks (user_id)
  where status = 'pending' and tournament_id is null;

create unique index if not exists game_seeks_one_pending_per_user_tournament
  on public.game_seeks (user_id, tournament_id)
  where status = 'pending' and tournament_id is not null;

create index if not exists game_seeks_tournament_pending
  on public.game_seeks (tournament_id, time_control_seconds, increment_seconds, rated)
  where status = 'pending';

-- 4) Refresh tournament status by clock
create or replace function public.refresh_tournament_status(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_created timestamptz;
  v_duration int;
begin
  select status, starts_at, ends_at, created_at, coalesce(duration_minutes, 60)
  into v_status, v_starts, v_ends, v_created, v_duration
  from tournaments where id = p_id for update;

  if v_status is null then
    return null;
  end if;

  if v_ends is null then
    v_ends := coalesce(v_starts, v_created) + make_interval(mins => v_duration);
    update tournaments set ends_at = v_ends where id = p_id;
  end if;

  if v_status = 'finished' then
    return v_status;
  end if;

  if now() >= v_ends then
    update tournaments set status = 'finished' where id = p_id;
    update game_seeks set status = 'cancelled'
    where tournament_id = p_id and status = 'pending';
    return 'finished';
  end if;

  if v_status = 'open' and (v_starts is null or now() >= v_starts) then
    update tournaments set status = 'started' where id = p_id;
    return 'started';
  end if;

  return v_status;
end;
$$;

grant execute on function public.refresh_tournament_status(uuid) to authenticated;
grant execute on function public.refresh_tournament_status(uuid) to service_role;

-- 5) Arena score bump after game finish
create or replace function public.apply_arena_game_result(p_game_id uuid, p_winner text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid uuid;
  v_white text;
  v_black text;
  v_w_pts numeric;
  v_b_pts numeric;
begin
  select tournament_id into v_tid from games where id = p_game_id;
  if v_tid is null then
    return;
  end if;

  select
    max(case when side = 'white' then player_id end),
    max(case when side = 'black' then player_id end)
  into v_white, v_black
  from game_players where game_id = p_game_id;

  if v_white is null or v_black is null then
    return;
  end if;

  if p_winner = 'white' then
    v_w_pts := 2; v_b_pts := 0;
  elsif p_winner = 'black' then
    v_w_pts := 0; v_b_pts := 2;
  else
    v_w_pts := 1; v_b_pts := 1;
  end if;

  update tournament_players
  set score = score + v_w_pts, games_played = games_played + 1
  where tournament_id = v_tid and user_id = v_white::uuid and withdrawn = false;

  update tournament_players
  set score = score + v_b_pts, games_played = games_played + 1
  where tournament_id = v_tid and user_id = v_black::uuid and withdrawn = false;
end;
$$;

revoke all on function public.apply_arena_game_result(uuid, text) from public;
grant execute on function public.apply_arena_game_result(uuid, text) to service_role;

-- 6) Replace match_or_create_seek with tournament support
drop function if exists public.match_or_create_seek(int, int, boolean, text);

create or replace function public.match_or_create_seek(
  p_time int,
  p_increment int,
  p_rated boolean,
  p_color text,
  p_tournament_id uuid default null
)
returns table(seek_id uuid, game_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_opp public.game_seeks%rowtype;
  v_my_seek_id uuid;
  v_game_id uuid;
  v_white text;
  v_black text;
  v_now timestamptz := now();
  v_initial bigint;
  v_my_color text;
  v_t_status text;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  if p_color is null or p_color not in ('white', 'black', 'random') then
    raise exception 'invalid_color';
  end if;

  if p_time is null or p_time < 1 or p_time > 86400 then
    raise exception 'invalid_time';
  end if;

  if p_increment is null or p_increment < 0 or p_increment > 120 then
    raise exception 'invalid_increment';
  end if;

  if p_rated and not exists (select 1 from profiles where id = v_me) then
    raise exception 'profile_required';
  end if;

  if p_tournament_id is not null then
    v_t_status := public.refresh_tournament_status(p_tournament_id);
    if v_t_status is distinct from 'started' then
      raise exception 'tournament_not_active';
    end if;
    if not exists (
      select 1 from tournament_players
      where tournament_id = p_tournament_id
        and user_id = v_me
        and withdrawn = false
    ) then
      raise exception 'not_in_tournament';
    end if;
  end if;

  if p_tournament_id is null then
    update public.game_seeks
    set status = 'cancelled'
    where user_id = v_me and status = 'pending' and tournament_id is null;
  else
    update public.game_seeks
    set status = 'cancelled'
    where user_id = v_me and status = 'pending' and tournament_id = p_tournament_id;
  end if;

  select s.* into v_opp
  from public.game_seeks s
  where s.status = 'pending'
    and s.user_id <> v_me
    and s.time_control_seconds = p_time
    and s.increment_seconds = p_increment
    and s.rated = p_rated
    and (
      (p_tournament_id is null and s.tournament_id is null)
      or (p_tournament_id is not null and s.tournament_id = p_tournament_id)
    )
    and (
      (p_color = 'random' and s.color = 'random')
      or (p_color = 'white' and s.color in ('black', 'random'))
      or (p_color = 'black' and s.color in ('white', 'random'))
      or (p_color = 'random' and s.color in ('white', 'black'))
    )
  order by s.created_at asc
  for update skip locked
  limit 1;

  if v_opp.id is null then
    insert into public.game_seeks (
      user_id, time_control_seconds, increment_seconds, rated, color, status, tournament_id
    ) values (
      v_me, p_time, p_increment, coalesce(p_rated, true), p_color, 'pending', p_tournament_id
    )
    returning id into v_my_seek_id;

    seek_id := v_my_seek_id;
    game_id := null;
    return next;
    return;
  end if;

  v_my_color := p_color;
  if v_my_color = 'random' and v_opp.color = 'random' then
    if random() < 0.5 then
      v_white := v_me::text; v_black := v_opp.user_id::text;
    else
      v_white := v_opp.user_id::text; v_black := v_me::text;
    end if;
  elsif v_my_color = 'white' or (v_my_color = 'random' and v_opp.color = 'black') then
    v_white := v_me::text; v_black := v_opp.user_id::text;
  elsif v_my_color = 'black' or (v_my_color = 'random' and v_opp.color = 'white') then
    v_white := v_opp.user_id::text; v_black := v_me::text;
  elsif v_opp.color = 'white' then
    v_white := v_opp.user_id::text; v_black := v_me::text;
  else
    v_white := v_me::text; v_black := v_opp.user_id::text;
  end if;

  v_initial := (p_time::bigint) * 1000;

  insert into public.games (
    status, fen, creator_color, time_control_seconds, increment_seconds, rated,
    active_color, started_at, winner, white_time_left, black_time_left, last_move_at,
    created_by, tournament_id
  ) values (
    'active', 'startpos', 'random', p_time, p_increment, p_rated,
    'w', v_now, null, v_initial, v_initial, v_now,
    v_me::text, p_tournament_id
  ) returning id into v_game_id;

  insert into public.game_players (game_id, side, player_id)
  values
    (v_game_id, 'white', v_white),
    (v_game_id, 'black', v_black);

  update public.game_seeks
  set status = 'matched', game_id = v_game_id, matched_at = v_now
  where id = v_opp.id;

  insert into public.game_seeks (
    user_id, time_control_seconds, increment_seconds, rated, color,
    status, game_id, matched_at, tournament_id
  ) values (
    v_me, p_time, p_increment, p_rated, p_color,
    'matched', v_game_id, v_now, p_tournament_id
  ) returning id into v_my_seek_id;

  seek_id := v_my_seek_id;
  game_id := v_game_id;
  return next;
end;
$$;

revoke all on function public.match_or_create_seek(int, int, boolean, text, uuid) from public;
grant execute on function public.match_or_create_seek(int, int, boolean, text, uuid) to authenticated;
grant execute on function public.match_or_create_seek(int, int, boolean, text, uuid) to service_role;

comment on column public.games.tournament_id is 'Arena tournament this game belongs to (Phase E).';
