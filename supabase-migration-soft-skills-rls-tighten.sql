-- Tighten Soft Skills RLS: students read only own entries; staff read all.
-- Run in Supabase SQL Editor after soft-skills migrations.

drop policy if exists soft_skills_discipline_entries_select_all
  on public.soft_skills_discipline_entries;
drop policy if exists soft_skills_discipline_entries_select_authenticated
  on public.soft_skills_discipline_entries;
drop policy if exists soft_skills_discipline_entries_select_own_or_staff
  on public.soft_skills_discipline_entries;
create policy soft_skills_discipline_entries_select_own_or_staff
  on public.soft_skills_discipline_entries for select
  to authenticated
  using (auth.uid() = user_id or public.is_teacher_or_admin());

drop policy if exists soft_skills_self_ratings_select on public.soft_skills_self_ratings;
drop policy if exists soft_skills_self_ratings_staff_read on public.soft_skills_self_ratings;
drop policy if exists soft_skills_self_ratings_select_authenticated
  on public.soft_skills_self_ratings;
drop policy if exists soft_skills_self_ratings_select_own_or_staff
  on public.soft_skills_self_ratings;
create policy soft_skills_self_ratings_select_own_or_staff
  on public.soft_skills_self_ratings for select
  to authenticated
  using (auth.uid() = user_id or public.is_teacher_or_admin());
