-- Delete all child comments and child program ratings from all weeks.
-- Run in Supabase SQL Editor.

begin;

delete from public.child_program_ratings;
do $$
begin
  if to_regclass('public.child_comments') is not null then
    delete from public.child_comments;
  end if;
end $$;

commit;
