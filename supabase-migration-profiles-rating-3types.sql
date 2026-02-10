-- Раздельные рейтинги: bullet/blitz/rapid + история для графика (как на lichess)
-- Выполнить в Supabase: SQL Editor → вставить → Run.

-- 1) Добавляем 3 рейтинга в profiles (старт 1500)
alter table public.profiles
  add column if not exists rating_bullet integer not null default 1500,
  add column if not exists rating_blitz integer not null default 1500,
  add column if not exists rating_rapid integer not null default 1500;

comment on column public.profiles.rating_bullet is 'Рейтинг Bullet (Elo), старт 1500.';
comment on column public.profiles.rating_blitz  is 'Рейтинг Blitz (Elo), старт 1500.';
comment on column public.profiles.rating_rapid  is 'Рейтинг Rapid (Elo), старт 1500.';

-- Сохраняем уже существующий рейтинг: копируем текущее profiles.rating во все 3 категории
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='rating'
  ) then
    update public.profiles
    set rating_bullet = rating,
        rating_blitz  = rating,
        rating_rapid  = rating;
  end if;
end $$;

-- 2) Таблица истории рейтинга (для графика)
create table if not exists public.rating_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bullet','blitz','rapid')),
  rating integer not null,
  game_id uuid references public.games(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists rating_history_user_cat_time
  on public.rating_history(user_id, category, created_at);

alter table public.rating_history enable row level security;

drop policy if exists rating_history_select_public on public.rating_history;
create policy rating_history_select_public
  on public.rating_history for select
  to authenticated
  using (true);

-- Вставку делает только security definer функция
drop policy if exists rating_history_insert_none on public.rating_history;
create policy rating_history_insert_none
  on public.rating_history for insert
  to authenticated
  with check (false);

comment on table public.rating_history is 'История рейтинга по категориям для графика.';

-- 3) Обновление рейтинга по итогам партии (категория зависит от time_control_seconds)
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
begin
  select gp_white.player_id::uuid, gp_black.player_id::uuid
  into v_white_id, v_black_id
  from game_players gp_white
  join game_players gp_black on gp_black.game_id = gp_white.game_id and gp_black.side = 'black'
  where gp_white.game_id = p_game_id and gp_white.side = 'white';

  if v_white_id is null or v_black_id is null then
    return;
  end if;

  select time_control_seconds into v_time
  from games
  where id = p_game_id;

  -- Категоризация под наши пресеты:
  -- bullet: <= 2 мин; blitz: <= 5 мин; rapid: > 5 мин
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
end;
$$;

grant execute on function public.update_game_ratings(uuid, text) to authenticated;
grant execute on function public.update_game_ratings(uuid, text) to service_role;

-- Realtime: если захотите график в реальном времени, можно добавить rating_history в publication
-- (не обязательно, график обычно грузится по запросу)

