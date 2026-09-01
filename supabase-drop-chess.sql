-- Remove chess live-play feature from database.
-- Safe to run after backing up if needed.
-- Run in Supabase SQL Editor.

-- Drop chess RPCs
drop function if exists public.accept_seek(uuid);
drop function if exists public.match_or_create_seek(integer, integer, boolean, text, uuid);
drop function if exists public.accept_game_challenge(uuid);
drop function if exists public.update_game_ratings(uuid, text);

-- Unlink profiles from active chess games
alter table public.profiles drop column if exists current_game_id;

-- Drop chess tables (order matters for FKs)
drop table if exists public.game_moves cascade;
drop table if exists public.game_players cascade;
drop table if exists public.game_challenges cascade;
drop table if exists public.game_seeks cascade;
drop table if exists public.rating_history cascade;
drop table if exists public.games cascade;

-- Optional: remove chess rating columns from profiles (soft-skills ratings are separate)
alter table public.profiles drop column if exists rating;
alter table public.profiles drop column if exists rating_bullet;
alter table public.profiles drop column if exists rating_blitz;
alter table public.profiles drop column if exists rating_rapid;
alter table public.profiles drop column if exists games_played_bullet;
alter table public.profiles drop column if exists games_played_blitz;
alter table public.profiles drop column if exists games_played_rapid;
