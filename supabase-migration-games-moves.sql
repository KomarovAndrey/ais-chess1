-- Store move history for replay and PGN export.
-- Run in Supabase: SQL Editor → New query → paste → Run.

alter table public.games
  add column if not exists moves jsonb not null default '[]'::jsonb;

comment on column public.games.moves is 'Array of UCI moves, e.g. ["e2e4","e7e5"]';
