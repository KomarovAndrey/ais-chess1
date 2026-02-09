-- Миграция: политики для просмотра чужих профилей (список игр, статистика)
-- Выполнить в Supabase SQL Editor, если схема games уже применена, но профили с партиями не отображаются.

-- Чтение участников партий для публичных профилей
drop policy if exists game_players_select_authenticated on public.game_players;
create policy game_players_select_authenticated
  on public.game_players for select
  to authenticated
  using (true);

-- Чтение завершённых партий для отображения в профиле
drop policy if exists games_select_finished on public.games;
create policy games_select_finished
  on public.games for select
  to authenticated
  using (status = 'finished');
