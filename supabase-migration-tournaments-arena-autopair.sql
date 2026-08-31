-- Wave 5: Arena auto-pair idle players (pairing pool + realtime standings)
-- Run AFTER tournaments-arena and lichess-clock-start migrations.

-- 1) Pairing pool timestamp (NULL = not waiting for a game)
alter table public.tournament_players
  add column if not exists pairing_ready timestamptz;

comment on column public.tournament_players.pairing_ready is
  'Arena: player entered pairing pool; paired when two idle players are matched.';

-- 2) Helper: user has active game in this tournament
create or replace function public.arena_user_in_active_game(p_user uuid, p_tournament_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.game_players gp
    join public.games g on g.id = gp.game_id
    where gp.player_id = p_user::text
      and g.tournament_id = p_tournament_id
      and g.status = 'active'
  );
$$;

-- 3) Pair two oldest ready players (no pending seek) into a new game
create or replace function public.pair_arena_ready_players(p_tournament_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_time int;
  v_inc int;
  v_rated boolean;
  v_u1 uuid;
  v_u2 uuid;
  v_game_id uuid;
  v_white text;
  v_black text;
  v_now timestamptz := now();
  v_initial bigint;
  v_created int := 0;
begin
  select time_control_seconds, increment_seconds, coalesce(rated, true)
  into v_time, v_inc, v_rated
  from public.tournaments
  where id = p_tournament_id;

  if v_time is null then
    return 0;
  end if;

  loop
    select tp1.user_id, tp2.user_id
    into v_u1, v_u2
    from public.tournament_players tp1
    join public.tournament_players tp2
      on tp2.tournament_id = tp1.tournament_id
      and tp1.user_id < tp2.user_id
    where tp1.tournament_id = p_tournament_id
      and tp1.withdrawn = false
      and tp2.withdrawn = false
      and tp1.pairing_ready is not null
      and tp2.pairing_ready is not null
      and not public.arena_user_in_active_game(tp1.user_id, p_tournament_id)
      and not public.arena_user_in_active_game(tp2.user_id, p_tournament_id)
      and not exists (
        select 1 from public.game_seeks s
        where s.status = 'pending'
          and s.tournament_id = p_tournament_id
          and s.user_id in (tp1.user_id, tp2.user_id)
      )
    order by least(tp1.pairing_ready, tp2.pairing_ready)
    limit 1
    for update of tp1, tp2 skip locked;

    if v_u1 is null or v_u2 is null then
      exit;
    end if;

    if random() < 0.5 then
      v_white := v_u1::text;
      v_black := v_u2::text;
    else
      v_white := v_u2::text;
      v_black := v_u1::text;
    end if;

    v_initial := (v_time::bigint) * 1000;

    insert into public.games (
      status, fen, creator_color, time_control_seconds, increment_seconds, rated,
      active_color, started_at, winner, white_time_left, black_time_left, last_move_at,
      created_by, tournament_id
    ) values (
      'active', 'startpos', 'random', v_time, v_inc, v_rated,
      'w', v_now, null, v_initial, v_initial, null,
      v_u1::text, p_tournament_id
    ) returning id into v_game_id;

    insert into public.game_players (game_id, side, player_id)
    values
      (v_game_id, 'white', v_white),
      (v_game_id, 'black', v_black);

    update public.tournament_players
    set pairing_ready = null
    where tournament_id = p_tournament_id
      and user_id in (v_u1, v_u2);

    update public.game_seeks
    set status = 'cancelled'
    where tournament_id = p_tournament_id
      and status = 'pending'
      and user_id in (v_u1, v_u2);

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.pair_arena_ready_players(uuid) from public;
grant execute on function public.pair_arena_ready_players(uuid) to authenticated;
grant execute on function public.pair_arena_ready_players(uuid) to service_role;

-- 4) Enter pairing pool (auto-pair + seek fallback)
create or replace function public.arena_enter_pairing(p_tournament_id uuid)
returns table(game_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_t_status text;
  v_time int;
  v_inc int;
  v_rated boolean;
  v_active_game uuid;
  v_seek_id uuid;
  v_new_game uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  v_t_status := public.refresh_tournament_status(p_tournament_id);
  if v_t_status is distinct from 'started' then
    raise exception 'tournament_not_active';
  end if;

  if not exists (
    select 1 from public.tournament_players
    where tournament_id = p_tournament_id
      and user_id = v_me
      and withdrawn = false
  ) then
    raise exception 'not_in_tournament';
  end if;

  select g.id into v_active_game
  from public.games g
  join public.game_players gp on gp.game_id = g.id and gp.player_id = v_me::text
  where g.tournament_id = p_tournament_id and g.status = 'active'
  limit 1;

  if v_active_game is not null then
    game_id := v_active_game;
    status := 'active';
    return next;
    return;
  end if;

  select time_control_seconds, increment_seconds, coalesce(rated, true)
  into v_time, v_inc, v_rated
  from public.tournaments
  where id = p_tournament_id;

  update public.tournament_players
  set pairing_ready = now()
  where tournament_id = p_tournament_id and user_id = v_me and withdrawn = false;

  perform public.pair_arena_ready_players(p_tournament_id);

  select g.id into v_active_game
  from public.games g
  join public.game_players gp on gp.game_id = g.id and gp.player_id = v_me::text
  where g.tournament_id = p_tournament_id and g.status = 'active'
  limit 1;

  if v_active_game is not null then
    game_id := v_active_game;
    status := 'matched';
    return next;
    return;
  end if;

  select s.seek_id, s.game_id into v_seek_id, v_new_game
  from public.match_or_create_seek(v_time, v_inc, v_rated, 'random', p_tournament_id) s
  limit 1;

  perform public.pair_arena_ready_players(p_tournament_id);

  if v_new_game is not null then
    game_id := v_new_game;
    status := 'matched';
    return next;
    return;
  end if;

  select g.id into v_active_game
  from public.games g
  join public.game_players gp on gp.game_id = g.id and gp.player_id = v_me::text
  where g.tournament_id = p_tournament_id and g.status = 'active'
  limit 1;

  if v_active_game is not null then
    game_id := v_active_game;
    status := 'matched';
    return next;
    return;
  end if;

  game_id := null;
  status := 'waiting';
  return next;
end;
$$;

revoke all on function public.arena_enter_pairing(uuid) from public;
grant execute on function public.arena_enter_pairing(uuid) to authenticated;
grant execute on function public.arena_enter_pairing(uuid) to service_role;

-- 5) Leave pairing pool
create or replace function public.arena_leave_pairing(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  update public.tournament_players
  set pairing_ready = null
  where tournament_id = p_tournament_id and user_id = v_me;

  update public.game_seeks
  set status = 'cancelled'
  where user_id = v_me
    and tournament_id = p_tournament_id
    and status = 'pending';
end;
$$;

grant execute on function public.arena_leave_pairing(uuid) to authenticated;
grant execute on function public.arena_leave_pairing(uuid) to service_role;

-- 6) Realtime standings
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tournament_players'
  ) then
    alter publication supabase_realtime add table public.tournament_players;
  end if;
end $$;
