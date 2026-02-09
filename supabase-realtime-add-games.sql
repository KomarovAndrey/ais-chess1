-- Добавить таблицу games в публикацию Realtime (идемпотентно).
-- Если таблица уже в публикации, ошибки не будет.
-- Выполните в Supabase: SQL Editor → вставить → Run.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;
