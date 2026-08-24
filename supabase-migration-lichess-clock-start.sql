-- Lichess-style clock start: freeze clocks until White's first move.
-- last_move_at stays NULL when a game becomes active; set on the first move.
-- Run in Supabase SQL editor after deploying app code that expects this contract.

-- In-flight active games with no moves yet should not be ticking.
update public.games
set last_move_at = null
where status = 'active'
  and coalesce(jsonb_array_length(moves), 0) = 0
  and last_move_at is not null;

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
    'w', v_now, null, v_initial, v_initial, null,
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
    active_color, started_at, winner, white_time_left, black_time_left, last_move_at,
    created_by
  ) values (
    'active', 'startpos', v_creator_color, v_time, v_inc, v_rated,
    'w', v_now, null, v_initial, v_initial, null,
    v_from::text
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

comment on column public.games.last_move_at is
  'Timestamp of last completed move. NULL until White plays (clocks frozen, Lichess-style).';
