-- Program ratings for child cards by week.
-- Run in Supabase SQL Editor.

create table if not exists public.child_program_ratings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  child_id uuid not null references public.children(id) on delete cascade,
  evaluator_id uuid not null references public.profiles(id) on delete cascade,
  week_number integer not null default 30 check (week_number >= 1),
  program text not null check (program in ('Robo', 'Lumo', 'Sport', '3D')),
  leadership text not null default '-' check (leadership in ('1', '2', '3', '4', '5', '-')),
  communication text not null default '-' check (communication in ('1', '2', '3', '4', '5', '-')),
  self_reflection text not null default '-' check (self_reflection in ('1', '2', '3', '4', '5', '-')),
  critical_thinking text not null default '-' check (critical_thinking in ('1', '2', '3', '4', '5', '-')),
  self_control text not null default '-' check (self_control in ('1', '2', '3', '4', '5', '-')),
  sport_result text check (sport_result in ('win', 'lose') or sport_result is null),
  sport_goals integer not null default 0 check (sport_goals >= 0)
);

alter table public.child_program_ratings
  add column if not exists sport_result text;

alter table public.child_program_ratings
  add column if not exists sport_goals integer not null default 0;

alter table public.child_program_ratings
  drop constraint if exists child_program_ratings_sport_result_check;

alter table public.child_program_ratings
  add constraint child_program_ratings_sport_result_check
  check (sport_result in ('win', 'lose') or sport_result is null);

alter table public.child_program_ratings
  drop constraint if exists child_program_ratings_sport_goals_check;

alter table public.child_program_ratings
  add constraint child_program_ratings_sport_goals_check
  check (sport_goals >= 0);

create unique index if not exists child_program_ratings_unique_idx
  on public.child_program_ratings(child_id, evaluator_id, week_number, program);

create index if not exists child_program_ratings_child_week_idx
  on public.child_program_ratings(child_id, week_number);

create or replace function public.update_child_program_ratings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists child_program_ratings_updated_at on public.child_program_ratings;
create trigger child_program_ratings_updated_at
  before update on public.child_program_ratings
  for each row
  execute function public.update_child_program_ratings_updated_at();

alter table public.child_program_ratings enable row level security;

drop policy if exists child_program_ratings_select_teacher_admin on public.child_program_ratings;
create policy child_program_ratings_select_teacher_admin
  on public.child_program_ratings for select
  to authenticated
  using (public.is_teacher_or_admin());

drop policy if exists child_program_ratings_insert_own on public.child_program_ratings;
create policy child_program_ratings_insert_own
  on public.child_program_ratings for insert
  to authenticated
  with check (public.is_teacher_or_admin() and evaluator_id = auth.uid());

drop policy if exists child_program_ratings_update_own on public.child_program_ratings;
create policy child_program_ratings_update_own
  on public.child_program_ratings for update
  to authenticated
  using (evaluator_id = auth.uid())
  with check (evaluator_id = auth.uid());

drop policy if exists child_program_ratings_delete_own_or_admin on public.child_program_ratings;
create policy child_program_ratings_delete_own_or_admin
  on public.child_program_ratings for delete
  to authenticated
  using (
    evaluator_id = auth.uid()
    or (
      public.is_teacher_or_admin()
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );
