-- Рейтинг для зарегистрированных игроков (один общий, старт 1500)
-- Выполнить в Supabase: SQL Editor → вставить → Run.

alter table public.profiles
  add column if not exists rating integer not null default 1500;

comment on column public.profiles.rating is 'Шахматный рейтинг (Elo), стартовый 1500. Только у зарегистрированных.';

-- Публичное чтение username и rating для отображения в партии (и для гостей)
drop policy if exists profiles_select_public_anon on public.profiles;
create policy profiles_select_public_anon
  on public.profiles for select
  to anon
  using (true);

-- Для authenticated уже есть profiles_select_public

-- Обновление рейтингов по итогам партии (вызов из API, security definer)
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
begin
  select gp_white.player_id, gp_black.player_id
  into v_white_id, v_black_id
  from game_players gp_white
  join game_players gp_black on gp_black.game_id = gp_white.game_id and gp_black.side = 'black'
  where gp_white.game_id = p_game_id and gp_white.side = 'white';

  if v_white_id is null or v_black_id is null then
    return;
  end if;

  select p1.rating, p2.rating into v_white_rating, v_black_rating
  from profiles p1, profiles p2
  where p1.id = v_white_id and p2.id = v_black_id;

  if v_white_rating is null or v_black_rating is null then
    return;
  end if;

  v_score_white := case p_winner when 'white' then 1.0 when 'black' then 0.0 else 0.5 end;
  v_score_black := 1.0 - v_score_white;
  v_expected_white := 1.0 / (1.0 + power(10, (v_black_rating - v_white_rating)::numeric / 400));
  v_new_white := round(v_white_rating + v_elo_k * (v_score_white - v_expected_white));
  v_new_black := round(v_black_rating + v_elo_k * (v_score_black - (1 - v_expected_white)));

  update profiles set rating = v_new_white where id = v_white_id;
  update profiles set rating = v_new_black where id = v_black_id;
end;
$$;

grant execute on function public.update_game_ratings(uuid, text) to authenticated;
grant execute on function public.update_game_ratings(uuid, text) to service_role;
