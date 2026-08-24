-- Phase G: provisional Elo, public rating history, DB rate buckets, reports
-- Run after matchmaking + live protocol migrations

-- 1) Games played per category (provisional Elo)
alter table public.profiles
  add column if not exists games_played_bullet integer not null default 0;

alter table public.profiles
  add column if not exists games_played_blitz integer not null default 0;

alter table public.profiles
  add column if not exists games_played_rapid integer not null default 0;

-- 2) Public read of rating history (profiles without login)
drop policy if exists rating_history_select_public on public.rating_history;
create policy rating_history_select_public
  on public.rating_history for select
  to authenticated
  using (true);

drop policy if exists rating_history_select_anon on public.rating_history;
create policy rating_history_select_anon
  on public.rating_history for select
  to anon
  using (true);

-- 3) Provisional Elo: K=40 for first 20 rated games in category, else K=20
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
  v_white_played int;
  v_black_played int;
  v_white_has_profile boolean;
  v_black_has_profile boolean;
  v_score_white numeric;
  v_score_black numeric;
  v_expected_white numeric;
  v_new_white int;
  v_new_black int;
  v_k_white int;
  v_k_black int;
  v_time int;
  v_category text;
  v_col text;
  v_played_col text;
  v_now timestamptz := now();
  v_status text;
  v_winner text;
  v_applied boolean;
  v_rated boolean;
  v_provisional_n int := 20;
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

  v_played_col :=
    case v_category
      when 'bullet' then 'games_played_bullet'
      when 'blitz' then 'games_played_blitz'
      else 'games_played_rapid'
    end;

  execute format('select %I from profiles where id = $1', v_col) into v_white_rating using v_white_id;
  execute format('select %I from profiles where id = $1', v_col) into v_black_rating using v_black_id;
  execute format('select coalesce(%I, 0) from profiles where id = $1', v_played_col)
    into v_white_played using v_white_id;
  execute format('select coalesce(%I, 0) from profiles where id = $1', v_played_col)
    into v_black_played using v_black_id;

  if v_white_rating is null then v_white_rating := 1500; end if;
  if v_black_rating is null then v_black_rating := 1500; end if;
  if v_white_played is null then v_white_played := 0; end if;
  if v_black_played is null then v_black_played := 0; end if;

  v_k_white := case when v_white_played < v_provisional_n then 40 else 20 end;
  v_k_black := case when v_black_played < v_provisional_n then 40 else 20 end;

  v_score_white := case p_winner when 'white' then 1.0 when 'black' then 0.0 else 0.5 end;
  v_score_black := 1.0 - v_score_white;
  v_expected_white := 1.0 / (1.0 + power(10, (v_black_rating - v_white_rating)::numeric / 400));
  v_new_white := round(v_white_rating + v_k_white * (v_score_white - v_expected_white));
  v_new_black := round(v_black_rating + v_k_black * (v_score_black - (1 - v_expected_white)));

  execute format(
    'update profiles set %I = $1, %I = coalesce(%I, 0) + 1 where id = $2',
    v_col, v_played_col, v_played_col
  ) using v_new_white, v_white_id;

  execute format(
    'update profiles set %I = $1, %I = coalesce(%I, 0) + 1 where id = $2',
    v_col, v_played_col, v_played_col
  ) using v_new_black, v_black_id;

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

-- 4) Optional distributed rate limit buckets
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

create or replace function public.check_rate_limit_bucket(
  p_key text,
  p_limit integer default 60,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count int;
  v_reset timestamptz;
begin
  if p_key is null or length(p_key) < 1 then
    return false;
  end if;

  select count, reset_at into v_count, v_reset
  from rate_limit_buckets
  where bucket_key = p_key
  for update;

  if not found or v_reset <= v_now then
    insert into rate_limit_buckets (bucket_key, count, reset_at)
    values (p_key, 1, v_now + make_interval(secs => greatest(p_window_seconds, 1)))
    on conflict (bucket_key) do update
      set count = 1,
          reset_at = excluded.reset_at;
    return true;
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  update rate_limit_buckets set count = count + 1 where bucket_key = p_key;
  return true;
end;
$$;

revoke all on function public.check_rate_limit_bucket(text, integer, integer) from public;
grant execute on function public.check_rate_limit_bucket(text, integer, integer) to service_role;
grant execute on function public.check_rate_limit_bucket(text, integer, integer) to authenticated;

-- 5) Minimal reports
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  check (target_user_id is not null or game_id is not null)
);

alter table public.user_reports enable row level security;

drop policy if exists user_reports_insert_own on public.user_reports;
create policy user_reports_insert_own
  on public.user_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists user_reports_select_admin on public.user_reports;
create policy user_reports_select_admin
  on public.user_reports for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role::text = 'admin'
    )
  );

comment on column public.profiles.games_played_blitz is 'Rated games count for provisional Elo (Phase G).';
