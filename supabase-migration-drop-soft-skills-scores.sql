-- Deprecated: soft_skills_scores is no longer used (ratings use soft_skills_discipline_entries).
-- Safe to run when you want to remove the legacy table.

drop table if exists public.soft_skills_scores;
