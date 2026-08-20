-- Game integrity: ratings can only be applied once, and only for finished games
-- whose winner matches. Client UPDATE policies on games are removed so outcomes
-- must go through the Next.js API with SUPABASE_SERVICE_ROLE_KEY.
--
-- Run in Supabase SQL Editor AFTER deploying the integrity API changes and
-- setting SUPABASE_SERVICE_ROLE_KEY on Vercel / .env.local.

-- 1) Idempotent ratings flag
alter table public.games
  add column if not exists ratings_applied boolean not null default false;

-- Backfill: treat already-finished games as rated to avoid double Elo on next call
update public.games
set ratings_applied = true
where status = 'finished' and ratings_applied = false;

-- 2) Harden update_game_ratings
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
begin
  if p_winner is null or p_winner not in ('white', 'black', 'draw') then
    raise exception 'invalid winner';
  end if;

  select status, winner, ratings_applied, time_control_seconds
    into v_status, v_winner, v_applied, v_time
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

  -- Guests: mark applied without changing Elo
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

-- 3) Remove direct client updates of game state (API + service role only)
drop policy if exists games_update_anon on public.games;
drop policy if exists games_update_for_players on public.games;
