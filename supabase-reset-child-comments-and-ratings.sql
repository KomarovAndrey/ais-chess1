-- Delete all child comments and child program ratings from all weeks.
-- Run in Supabase SQL Editor.

begin;

delete from public.child_program_ratings;
delete from public.child_comments;

commit;
