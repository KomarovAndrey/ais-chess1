-- Игра без регистрации: разрешить анонимным пользователям создавать партии и присоединяться.
-- Выполнить в Supabase SQL Editor после основной схемы games.

-- Создание партии гостем
drop policy if exists games_insert_anon on public.games;
create policy games_insert_anon
  on public.games for insert
  to anon
  with check (true);

-- Чтение партии гостем (ожидающие и свои по game_players — через API)
drop policy if exists games_select_anon on public.games;
create policy games_select_anon
  on public.games for select
  to anon
  using (true);

-- Обновление партии (ходы) — гость идентифицируется по playerId в API
drop policy if exists games_update_anon on public.games;
create policy games_update_anon
  on public.games for update
  to anon
  using (true)
  with check (true);

-- Участие в партии: вставка гостем
drop policy if exists game_players_insert_anon on public.game_players;
create policy game_players_insert_anon
  on public.game_players for insert
  to anon
  with check (true);

-- Чтение участников гостем
drop policy if exists game_players_select_anon on public.game_players;
create policy game_players_select_anon
  on public.game_players for select
  to anon
  using (true);
