-- Delete all children comments from all weeks.
-- Run in Supabase SQL Editor.

begin;

delete from public.child_comments;

commit;
