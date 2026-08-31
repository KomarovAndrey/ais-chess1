-- Remove shared child comments (comments are now per-discipline fields).
-- Safe to run multiple times.

begin;

drop table if exists public.child_comments cascade;

commit;

