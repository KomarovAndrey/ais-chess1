-- Wave 3: live seek lobby (public pending seeks) + accept specific seek.
-- Run in Supabase SQL Editor AFTER matchmaking / arena / lichess-clock-start migrations.

-- 1) Authenticated users can see pending lobby seeks (needed for Realtime + lobby UI).
--    Own seeks (any status relevant to the player) remain readable.
drop policy if exists game_seeks_select_own on public.game_seeks;
drop policy if exists game_seeks_select_lobby on public.game_seeks;

create policy game_seeks_select_lobby
  on public.game_seeks for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      status = 'pending'
      and tournament_id is null
    )
  );

-- Ensure Realtime publication (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'game_seeks'
  ) then
    alter publication supabase_realtime add table public.game_seeks;
  end if;
end $$;

-- 2) Accept a specific pending seek (challenge from lobby list)
create or replace function public.accept_seek(p_seek_id uuid)
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
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  if p_seek_id is null then
    raise exception 'seek_not_found';
  end if;

  select s.* into v_opp
  from public.game_seeks s
  where s.id = p_seek_id
  for update;

  if v_opp.id is null then
    raise exception 'seek_not_found';
  end if;

  if v_opp.status <> 'pending' then
    raise exception 'seek_not_pending';
  end if;

  if v_opp.user_id = v_me then
    raise exception 'cannot_accept_own_seek';
  end if;

  if v_opp.tournament_id is not null then
    raise exception 'tournament_seek';
  end if;

  if v_opp.rated and not exists (select 1 from profiles where id = v_me) then
    raise exception 'profile_required';
  end if;

  -- Cancel any existing pending lobby seek for this user
  update public.game_seeks
  set status = 'cancelled'
  where user_id = v_me
    and status = 'pending'
    and tournament_id is null;

  -- Acceptor takes the opposite of seeker's color preference
  if v_opp.color = 'white' then
    v_white := v_opp.user_id::text;
    v_black := v_me::text;
  elsif v_opp.color = 'black' then
    v_white := v_me::text;
    v_black := v_opp.user_id::text;
  else
    if random() < 0.5 then
      v_white := v_me::text;
      v_black := v_opp.user_id::text;
    else
      v_white := v_opp.user_id::text;
      v_black := v_me::text;
    end if;
  end if;

  v_initial := (v_opp.time_control_seconds::bigint) * 1000;

  insert into public.games (
    status, fen, creator_color, time_control_seconds, increment_seconds, rated,
    active_color, started_at, winner, white_time_left, black_time_left, last_move_at,
    created_by, tournament_id
  ) values (
    'active', 'startpos', 'random',
    v_opp.time_control_seconds, v_opp.increment_seconds, v_opp.rated,
    'w', v_now, null, v_initial, v_initial, null,
    v_me::text, null
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
    v_me, v_opp.time_control_seconds, v_opp.increment_seconds, v_opp.rated, 'random',
    'matched', v_game_id, v_now, null
  ) returning id into v_my_seek_id;

  seek_id := v_my_seek_id;
  game_id := v_game_id;
  return next;
end;
$$;

revoke all on function public.accept_seek(uuid) from public;
grant execute on function public.accept_seek(uuid) to authenticated;
grant execute on function public.accept_seek(uuid) to service_role;

comment on function public.accept_seek(uuid) is
  'Wave 3: accept a specific pending lobby seek and create an active game (clocks frozen until first moves).';
