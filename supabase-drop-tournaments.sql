-- Remove tournament feature from database.
-- Safe to skip if tournament migrations were never applied.
-- Run in Supabase SQL Editor after backing up if needed.

-- Drop tournament RPCs
drop function if exists public.pair_arena_ready_players(uuid);
drop function if exists public.arena_leave_pairing(uuid);
drop function if exists public.refresh_tournament_status(uuid);

-- Unlink games/seeks from tournaments
alter table public.game_seeks drop column if exists tournament_id;
alter table public.games drop column if exists tournament_id;

-- Drop tournament tables
drop table if exists public.tournament_players cascade;
drop table if exists public.tournaments cascade;

-- Restore lobby-only unique index on game_seeks (if column removed)
drop index if exists game_seeks_one_pending_per_user_lobby;
drop index if exists game_seeks_one_pending_per_user_tournament;
drop index if exists game_seeks_tournament_pending;

create unique index if not exists game_seeks_one_pending_per_user
  on public.game_seeks (user_id)
  where status = 'pending';
