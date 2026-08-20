-- Полное удаление Soft Skills / children из базы.
-- Выполните один раз в Supabase → SQL Editor → Run.
-- ВНИМАНИЕ: данные children / оценок будут удалены безвозвратно.

-- Realtime (если таблица была в publication)
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'child_program_ratings'
  ) then
    alter publication supabase_realtime drop table public.child_program_ratings;
  end if;
exception
  when others then
    null;
end $$;

drop trigger if exists child_program_ratings_updated_at on public.child_program_ratings;
drop function if exists public.update_child_program_ratings_updated_at();

drop table if exists public.child_program_ratings cascade;
drop table if exists public.child_comments cascade;
drop table if exists public.soft_skills_ratings cascade;
drop table if exists public.children cascade;

drop function if exists public.update_soft_skills_ratings_updated_at();
drop function if exists public.is_teacher_or_admin();
