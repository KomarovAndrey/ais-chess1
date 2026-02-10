-- Добавить таблицу friend_requests в публикацию Realtime (идемпотентно).
-- Выполните в Supabase: SQL Editor → вставить → Run.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'friend_requests'
  ) then
    alter publication supabase_realtime add table public.friend_requests;
  end if;
end $$;

