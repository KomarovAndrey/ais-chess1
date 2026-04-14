-- Weekly mode for children comments and soft skills ratings
-- Existing data is assigned to week 30.

-- child_comments removed (comments are stored per-discipline now)
do $$
begin
  if to_regclass('public.child_comments') is not null then
    alter table public.child_comments
      add column if not exists week_number integer not null default 30;

    alter table public.child_comments
      drop constraint if exists child_comments_week_number_check;

    alter table public.child_comments
      add constraint child_comments_week_number_check check (week_number >= 1);

    create index if not exists child_comments_child_week_created_at_idx
      on public.child_comments(child_id, week_number, created_at desc);

    create index if not exists child_comments_week_number_idx
      on public.child_comments(week_number);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.soft_skills_ratings') is not null then
    alter table public.soft_skills_ratings
      add column if not exists week_number integer not null default 30;

    alter table public.soft_skills_ratings
      drop constraint if exists soft_skills_ratings_week_number_check;

    alter table public.soft_skills_ratings
      add constraint soft_skills_ratings_week_number_check check (week_number >= 1);

    create index if not exists soft_skills_ratings_week_number_idx
      on public.soft_skills_ratings(week_number);

    create unique index if not exists soft_skills_ratings_evaluator_student_week_uidx
      on public.soft_skills_ratings(evaluator_id, student_id, week_number);
  end if;
end
$$;
