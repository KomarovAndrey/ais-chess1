-- Unify child_program_ratings: one row per (child, week, program), shared by all teachers.
-- Dedupes old per-evaluator rows (keeps newest by updated_at).
-- Run in Supabase SQL Editor after child_program_ratings exists.

begin;

-- Extra fields for Excel-style export (Lumo / Robo / 3D)
alter table public.child_program_ratings
  add column if not exists lumo_numeric_result bigint;

alter table public.child_program_ratings
  add column if not exists lumo_errors integer not null default 0;

alter table public.child_program_ratings
  add column if not exists robo_duration_text text;

alter table public.child_program_ratings
  add column if not exists d3_team_time text;

alter table public.child_program_ratings
  add column if not exists d3_participant_time text;

alter table public.child_program_ratings
  add column if not exists program_comment text;

alter table public.child_program_ratings
  drop constraint if exists child_program_ratings_lumo_errors_check;

alter table public.child_program_ratings
  add constraint child_program_ratings_lumo_errors_check
  check (lumo_errors >= 0);

-- Remove duplicate rows (same child/week/program from different evaluators); keep latest.
delete from public.child_program_ratings c
where c.id in (
  select id from (
    select id,
           row_number() over (
             partition by child_id, week_number, program
             order by updated_at desc nulls last, created_at desc nulls last
           ) as rn
    from public.child_program_ratings
  ) t
  where t.rn > 1
);

drop index if exists child_program_ratings_unique_idx;

create unique index if not exists child_program_ratings_child_week_program_uidx
  on public.child_program_ratings(child_id, week_number, program);

-- Any teacher may insert/update shared rows; evaluator_id = last saver (audit).
drop policy if exists child_program_ratings_insert_own on public.child_program_ratings;
create policy child_program_ratings_insert_shared
  on public.child_program_ratings for insert
  to authenticated
  with check (public.is_teacher_or_admin());

drop policy if exists child_program_ratings_update_own on public.child_program_ratings;
create policy child_program_ratings_update_shared
  on public.child_program_ratings for update
  to authenticated
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

drop policy if exists child_program_ratings_delete_own_or_admin on public.child_program_ratings;
create policy child_program_ratings_delete_admin  on public.child_program_ratings for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Realtime (ignore error if already in publication)
do $$
begin
  alter publication supabase_realtime add table public.child_program_ratings;
exception
  when duplicate_object then null;
end $$;

commit;
