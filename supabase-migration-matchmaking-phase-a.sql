-- Phase A: matchmaking seeks, increment clocks, rated/casual, abort, rematch
-- Run in Supabase SQL Editor AFTER game-integrity migration.

-- 1) Game columns
alter table public.games
  add column if not exists increment_seconds integer not null default 0;

alter table public.games
  add column if not exists rated boolean not null default true;

alter table public.games
  add column if not exists rematch_offer_from text;

alter table public.games
  add column if not exists rematch_game_id uuid references public.games(id) on delete set null;

alter table public.games
  add column if not exists end_reason text;

-- Allow aborted status (drop/recreate check)
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.games'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.games drop constraint %I', cname);
  end if;
end $$;

alter table public.games
  add constraint games_status_check
  check (status in ('waiting', 'active', 'finished', 'aborted'));

alter table public.games
  drop constraint if exists games_increment_seconds_check;
alter table public.games
  add constraint games_increment_seconds_check
  check (increment_seconds >= 0 and increment_seconds <= 120);

-- 2) Challenges: increment + rated
alter table public.game_challenges
  add column if not exists increment_seconds integer not null default 0;

alter table public.game_challenges
  add column if not exists rated boolean not null default true;

-- 3) Seeks (lobby)
create table if not exists public.game_seeks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  time_control_seconds integer not null
    check (time_control_seconds >= 1 and time_control_seconds <= 86400),
  increment_seconds integer not null default 0
    check (increment_seconds >= 0 and increment_seconds <= 120),
  rated boolean not null default true,
  color text not null default 'random'
    check (color in ('white', 'black', 'random')),
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'cancelled')),
  game_id uuid references public.games(id) on delete set null,
  matched_at timestamptz
);

create unique index if not exists game_seeks_one_pending_per_user
  on public.game_seeks(user_id)
  where status = 'pending';

create index if not exists game_seeks_pending_match
  on public.game_seeks(time_control_seconds, increment_seconds, rated, created_at)
  where status = 'pending';

alter table public.game_seeks enable row level security;

drop policy if exists game_seeks_select_own on public.game_seeks;
create policy game_seeks_select_own
  on public.game_seeks for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists game_seeks_insert_own on public.game_seeks;
create policy game_seeks_insert_own
  on public.game_seeks for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists game_seeks_update_own on public.game_seeks;
create policy game_seeks_update_own
  on public.game_seeks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists game_seeks_delete_own on public.game_seeks;
create policy game_seeks_delete_own
  on public.game_seeks for delete
  to authenticated
  using (auth.uid() = user_id);

-- Realtime for seeks
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'game_seeks'
  ) then
    alter publication supabase_realtime add table public.game_seeks;
  end if;
end $$;

-- 4) Atomic match-or-create seek → returns {seek_id, game_id}
create or replace function public.match_or_create_seek(
  p_time int,
  p_increment int,
  p_rated boolean,
  p_color text
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

  -- Rated seeks require a profile
  if p_rated and not exists (select 1 from profiles where id = v_me) then
    raise exception 'profile_required';
  end if;

  -- Cancel any existing pending seek for this user
  update public.game_seeks
  set status = 'cancelled'
  where user_id = v_me and status = 'pending';

  -- Find compatible opponent (oldest first), skip locked
  select s.* into v_opp
  from public.game_seeks s
  where s.status = 'pending'
    and s.user_id <> v_me
    and s.time_control_seconds = p_time
    and s.increment_seconds = p_increment
    and s.rated = p_rated
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
      user_id, time_control_seconds, increment_seconds, rated, color, status
    ) values (
      v_me, p_time, p_increment, coalesce(p_rated, true), p_color, 'pending'
    )
    returning id into v_my_seek_id;

    seek_id := v_my_seek_id;
    game_id := null;
    return next;
    return;
  end if;

  -- Assign colors
  v_my_color := p_color;
  if v_my_color = 'random' and v_opp.color = 'random' then
    if random() < 0.5 then
      v_white := v_me::text;
      v_black := v_opp.user_id::text;
    else
      v_white := v_opp.user_id::text;
      v_black := v_me::text;
    end if;
  elsif v_my_color = 'white' or (v_my_color = 'random' and v_opp.color = 'black') then
    v_white := v_me::text;
    v_black := v_opp.user_id::text;
  elsif v_my_color = 'black' or (v_my_color = 'random' and v_opp.color = 'white') then
    v_white := v_opp.user_id::text;
    v_black := v_me::text;
  elsif v_opp.color = 'white' then
    v_white := v_opp.user_id::text;
    v_black := v_me::text;
  else
    v_white := v_me::text;
    v_black := v_opp.user_id::text;
  end if;

  v_initial := (p_time::bigint) * 1000;

  insert into public.games (
    status, fen, creator_color, time_control_seconds, increment_seconds, rated,
    active_color, started_at, winner, white_time_left, black_time_left, last_move_at
  ) values (
    'active', 'startpos', 'random', p_time, p_increment, p_rated,
    'w', v_now, null, v_initial, v_initial, v_now
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
    status, game_id, matched_at
  ) values (
    v_me, p_time, p_increment, p_rated, p_color,
    'matched', v_game_id, v_now
  ) returning id into v_my_seek_id;

  seek_id := v_my_seek_id;
  game_id := v_game_id;
  return next;
end;
$$;

revoke all on function public.match_or_create_seek(int, int, boolean, text) from public;
grant execute on function public.match_or_create_seek(int, int, boolean, text) to authenticated;
grant execute on function public.match_or_create_seek(int, int, boolean, text) to service_role;

-- 5) Update accept_game_challenge for increment + rated
create or replace function public.accept_game_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid;
  v_to uuid;
  v_status text;
  v_creator_color text;
  v_time int;
  v_inc int;
  v_rated boolean;
  v_game_id uuid;
  v_white_id text;
  v_black_id text;
  v_now timestamptz := now();
  v_initial bigint;
begin
  select from_user_id, to_user_id, status, creator_color, time_control_seconds,
         coalesce(increment_seconds, 0), coalesce(rated, true)
  into v_from, v_to, v_status, v_creator_color, v_time, v_inc, v_rated
  from public.game_challenges
  where id = p_challenge_id
  for update;

  if v_from is null then
    raise exception 'challenge_not_found';
  end if;

  if v_to <> auth.uid() then
    raise exception 'forbidden';
  end if;

  if v_status <> 'pending' then
    raise exception 'challenge_not_pending';
  end if;

  v_initial := (v_time::bigint) * 1000;

  insert into public.games (
    status, fen, creator_color, time_control_seconds, increment_seconds, rated,
    active_color, started_at, winner, white_time_left, black_time_left, last_move_at
  ) values (
    'active', 'startpos', v_creator_color, v_time, v_inc, v_rated,
    'w', v_now, null, v_initial, v_initial, v_now
  ) returning id into v_game_id;

  if v_creator_color = 'white' then
    v_white_id := v_from::text;
    v_black_id := v_to::text;
  elsif v_creator_color = 'black' then
    v_white_id := v_to::text;
    v_black_id := v_from::text;
  else
    if random() < 0.5 then
      v_white_id := v_from::text;
      v_black_id := v_to::text;
    else
      v_white_id := v_to::text;
      v_black_id := v_from::text;
    end if;
  end if;

  insert into public.game_players (game_id, side, player_id)
  values
    (v_game_id, 'white', v_white_id),
    (v_game_id, 'black', v_black_id);

  update public.game_challenges
  set status = 'accepted',
      game_id = v_game_id,
      responded_at = v_now
  where id = p_challenge_id;

  return v_game_id;
end;
$$;

grant execute on function public.accept_game_challenge(uuid) to authenticated;
grant execute on function public.accept_game_challenge(uuid) to service_role;

-- 6) Ratings: skip unrated / aborted
create or replace function public.update_game_ratings(p_game_id uuid, p_winner text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_white_id uuid;
  v_black_id uuid;
  v_white_rating int;
  v_black_rating int;
  v_white_has_profile boolean;
  v_black_has_profile boolean;
  v_score_white numeric;
  v_score_black numeric;
  v_expected_white numeric;
  v_new_white int;
  v_new_black int;
  v_elo_k int := 32;
  v_time int;
  v_category text;
  v_col text;
  v_now timestamptz := now();
  v_status text;
  v_winner text;
  v_applied boolean;
  v_rated boolean;
begin
  if p_winner is null or p_winner not in ('white', 'black', 'draw') then
    raise exception 'invalid winner';
  end if;

  select status, winner, ratings_applied, time_control_seconds, coalesce(rated, true)
    into v_status, v_winner, v_applied, v_time, v_rated
  from games
  where id = p_game_id
  for update;

  if v_status is null then
    return;
  end if;

  if v_status <> 'finished' then
    raise exception 'game is not finished';
  end if;

  if v_winner is distinct from p_winner then
    raise exception 'winner mismatch';
  end if;

  if v_applied then
    return;
  end if;

  if not v_rated then
    update games set ratings_applied = true where id = p_game_id;
    return;
  end if;

  select gp_white.player_id::uuid, gp_black.player_id::uuid
  into v_white_id, v_black_id
  from game_players gp_white
  join game_players gp_black
    on gp_black.game_id = gp_white.game_id and gp_black.side = 'black'
  where gp_white.game_id = p_game_id and gp_white.side = 'white';

  if v_white_id is null or v_black_id is null then
    update games set ratings_applied = true where id = p_game_id;
    return;
  end if;

  select exists (select 1 from profiles where id = v_white_id),
         exists (select 1 from profiles where id = v_black_id)
    into v_white_has_profile, v_black_has_profile;

  if not v_white_has_profile or not v_black_has_profile then
    update games set ratings_applied = true where id = p_game_id;
    return;
  end if;

  v_category :=
    case
      when coalesce(v_time, 300) <= 120 then 'bullet'
      when coalesce(v_time, 300) <= 300 then 'blitz'
      else 'rapid'
    end;

  v_col :=
    case v_category
      when 'bullet' then 'rating_bullet'
      when 'blitz' then 'rating_blitz'
      else 'rating_rapid'
    end;

  execute format('select %I from profiles where id = $1', v_col) into v_white_rating using v_white_id;
  execute format('select %I from profiles where id = $1', v_col) into v_black_rating using v_black_id;

  if v_white_rating is null then v_white_rating := 1500; end if;
  if v_black_rating is null then v_black_rating := 1500; end if;

  v_score_white := case p_winner when 'white' then 1.0 when 'black' then 0.0 else 0.5 end;
  v_score_black := 1.0 - v_score_white;
  v_expected_white := 1.0 / (1.0 + power(10, (v_black_rating - v_white_rating)::numeric / 400));
  v_new_white := round(v_white_rating + v_elo_k * (v_score_white - v_expected_white));
  v_new_black := round(v_black_rating + v_elo_k * (v_score_black - (1 - v_expected_white)));

  execute format('update profiles set %I = $1 where id = $2', v_col) using v_new_white, v_white_id;
  execute format('update profiles set %I = $1 where id = $2', v_col) using v_new_black, v_black_id;

  insert into public.rating_history (user_id, category, rating, game_id, created_at)
  values
    (v_white_id, v_category, v_new_white, p_game_id, v_now),
    (v_black_id, v_category, v_new_black, p_game_id, v_now);

  update games set ratings_applied = true where id = p_game_id;
end;
$$;

revoke all on function public.update_game_ratings(uuid, text) from public;
revoke all on function public.update_game_ratings(uuid, text) from anon;
revoke all on function public.update_game_ratings(uuid, text) from authenticated;
grant execute on function public.update_game_ratings(uuid, text) to service_role;

comment on table public.game_seeks is 'Lobby seeks for rated/casual matchmaking (Phase A).';
