-- Delete all children comments from all weeks.
-- Run in Supabase SQL Editor.

begin;

do $$
begin
  if to_regclass('public.child_comments') is not null then
    delete from public.child_comments;
  end if;
end $$;

commit;
