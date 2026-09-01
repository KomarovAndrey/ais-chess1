-- Soft Skills: student self-assessment per module (5 competencies, 1–5).
create table if not exists public.soft_skills_self_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  star_leadership smallint not null default 0,
  star_communication smallint not null default 0,
  star_self_reflection smallint not null default 0,
  star_critical_thinking smallint not null default 0,
  star_self_control smallint not null default 0,
  updated_at timestamptz not null default now(),
  constraint soft_skills_self_ratings_module_check
    check (module_id in ('1','2','3','4','5','6')),
  constraint soft_skills_self_ratings_stars_check
    check (
      star_leadership between 0 and 5
      and star_communication between 0 and 5
      and star_self_reflection between 0 and 5
      and star_critical_thinking between 0 and 5
      and star_self_control between 0 and 5
    ),
  unique (user_id, module_id)
);

create index if not exists soft_skills_self_ratings_user_idx
  on public.soft_skills_self_ratings (user_id);

alter table public.soft_skills_self_ratings enable row level security;

drop policy if exists soft_skills_self_ratings_select on public.soft_skills_self_ratings;
create policy soft_skills_self_ratings_select
  on public.soft_skills_self_ratings for select
  to authenticated
  using (true);

drop policy if exists soft_skills_self_ratings_write_own on public.soft_skills_self_ratings;
create policy soft_skills_self_ratings_write_own
  on public.soft_skills_self_ratings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists soft_skills_self_ratings_staff_read on public.soft_skills_self_ratings;
create policy soft_skills_self_ratings_staff_read
  on public.soft_skills_self_ratings for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'teacher')
    )
  );
