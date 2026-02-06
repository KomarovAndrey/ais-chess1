-- Schema for online games (AIS Chess)
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste all → Run.
-- Fixes: "Could not find the table 'public.games' in the schema cache"

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'finished')),

  fen text not null,

  creator_color text not null default 'random'
    check (creator_color in ('white', 'black', 'random')),

  time_control_seconds integer not null,

  active_color text not null default 'w'
    check (active_color in ('w', 'b')),

  started_at timestamptz,

  winner text
    check (winner in ('white', 'black', 'draw')),

  white_time_left bigint not null,
  black_time_left bigint not null,
  last_move_at timestamptz
);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  side text not null
    check (side in ('white', 'black')),
  player_id text not null,
  joined_at timestamptz not null default now(),

  unique (game_id, side)
);

-- Optional: very open RLS for prototype (no auth).
-- For production, tighten these policies.
alter table public.games enable row level security;
alter table public.game_players enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'games'
      and policyname = 'games_public_rw'
  ) then
    create policy games_public_rw
      on public.games
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'game_players'
      and policyname = 'game_players_public_rw'
  ) then
    create policy game_players_public_rw
      on public.game_players
      for all
      using (true)
      with check (true);
  end if;
end
$$;

