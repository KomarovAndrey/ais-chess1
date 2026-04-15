-- Reset (truncate) Soft Skills data.
-- Safe to run multiple times. Run in Supabase SQL Editor.

begin;

-- 1) Ratings depend on children, so clear ratings first.
do $$
begin
  if to_regclass('public.child_program_ratings') is not null then
    delete from public.child_program_ratings;
  end if;
end $$;

-- 2) Optional legacy tables (if they exist in your DB)
do $$
begin
  if to_regclass('public.child_comments') is not null then
    delete from public.child_comments;
  end if;
end $$;

do $$
begin
  if to_regclass('public.soft_skills_ratings') is not null then
    delete from public.soft_skills_ratings;
  end if;
end $$;

commit;

