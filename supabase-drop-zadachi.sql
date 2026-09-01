-- Remove puzzles (Задачи) from Supabase — run in SQL Editor if feature was deployed.
-- Safe to skip if zadachi migration was never applied.

drop function if exists public.apply_puzzle_result(text, boolean);

drop table if exists public.puzzle_attempts;
drop table if exists public.puzzles;

alter table public.profiles drop column if exists rating_puzzle;
