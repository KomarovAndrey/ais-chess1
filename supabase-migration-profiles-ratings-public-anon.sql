-- Рейтинг игроков доступен без входа: анонимные пользователи могут читать профили (для страницы /ratings).
-- Выполнить в Supabase: SQL Editor → New query → вставить → Run.

drop policy if exists profiles_select_public_anon on public.profiles;
create policy profiles_select_public_anon
  on public.profiles for select
  to anon
  using (true);
