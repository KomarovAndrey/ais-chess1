-- Reversi games: play by link (anon allowed). Run in Supabase SQL Editor.

create table if not exists public.reversi_games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'finished')),
  board jsonb not null,
  turn text not null default 'black'
    check (turn in ('black', 'white')),
  winner text check (winner in ('black', 'white', 'draw')),
  creator_side text not null default 'random'
    check (creator_side in ('black', 'white', 'random')),
  black_player_id text,
  white_player_id text
);

comment on column public.reversi_games.board is '8x8 array of "black"|"white"|null';
comment on column public.reversi_games.black_player_id is 'Guest UUID or auth.uid()::text';
comment on column public.reversi_games.white_player_id is 'Guest UUID or auth.uid()::text';

alter table public.reversi_games enable row level security;

create policy reversi_select_any
  on public.reversi_games for select using (true);

create policy reversi_insert_any
  on public.reversi_games for insert with check (true);

-- Update allowed for all; API validates playerId for moves and join
create policy reversi_update_any
  on public.reversi_games for update using (true);
