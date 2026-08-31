-- Полная очистка данных AIS Chess в Supabase.
-- Выполните в Dashboard → SQL Editor → Run (роль postgres).
--
-- Удаляет:
--   • все строки во ВСЕХ таблицах схемы public (партии, профили, задачи, турниры, …)
--   • все учётные записи auth.users (логины)
--
-- Схема (таблицы, RLS, функции) НЕ удаляется.
-- После очистки для задач снова выполните supabase-seed-zadachi-lichess.sql (12k puzzles).
--
-- ВНИМАНИЕ: безвозвратно. Сделайте бэкап, если нужны данные.

begin;

-- 1) Все таблицы public
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format(
      'truncate table %I.%I restart identity cascade',
      r.schemaname,
      r.tablename
    );
    raise notice 'truncated %.%', r.schemaname, r.tablename;
  end loop;
end $$;

-- 2) Учётные записи (identities и sessions каскадом)
delete from auth.users;

commit;

-- Проверка (должны быть 0)
select 'profiles' as table_name, count(*) as rows from public.profiles
union all
select 'games', count(*) from public.games
union all
select 'puzzles', count(*) from public.puzzles
union all
select 'auth.users', count(*) from auth.users;
