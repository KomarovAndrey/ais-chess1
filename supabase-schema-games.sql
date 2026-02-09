-- Schema for online games (AIS Chess)
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste all → Run.
-- Fixes: "Could not find the table 'public.games' in the schema cache"
--
-- For live updates without page refresh: add table to Realtime publication.
-- In Dashboard: Database → Replication → supabase_realtime → add table "games".
-- Or run supabase-realtime-add-games.sql (idempotent). Or: alter publication supabase_realtime add table public.games;
-- (If you get "already member of publication", Realtime is already enabled.)

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

-- RLS: auth.uid()-based policies. Requires Supabase Auth.
alter table public.games enable row level security;
alter table public.game_players enable row level security;

drop policy if exists games_public_rw on public.games;
drop policy if exists game_players_public_rw on public.game_players;

create policy games_select_for_players
  on public.games for select
  using (
    exists (
      select 1 from public.game_players
      where game_id = games.id and player_id = auth.uid()::text
    )
    or (games.status = 'waiting')
  );

create policy games_insert_authenticated
  on public.games for insert
  to authenticated
  with check (true);

create policy games_update_for_players
  on public.games for update
  using (
    exists (
      select 1 from public.game_players
      where game_id = games.id and player_id = auth.uid()::text
    )
  );

create policy game_players_select_own
  on public.game_players for select
  using (player_id = auth.uid()::text);

create policy game_players_insert_own
  on public.game_players for insert
  to authenticated
  with check (player_id = auth.uid()::text);

-- Чтение участников партий для публичных профилей (список игр по игроку)
drop policy if exists game_players_select_authenticated on public.game_players;
create policy game_players_select_authenticated
  on public.game_players for select
  to authenticated
  using (true);

-- Чтение завершённых партий для отображения в профиле (статистика, последние игры)
drop policy if exists games_select_finished on public.games;
create policy games_select_finished
  on public.games for select
  to authenticated
  using (status = 'finished');

-- Optional: enable Realtime so both players see moves without refresh.
-- In Supabase Dashboard: Database → Replication → supabase_realtime → add table "games".
--
-- Or in SQL Editor run (once):
--   alter publication supabase_realtime add table public.games;
--
-- To run again without error if already added, use:
--   do $$
--   begin
--     if not exists (
--       select 1 from pg_publication_tables
--       where pubname = 'supabase_realtime' and tablename = 'games'
--     ) then
--       alter publication supabase_realtime add table public.games;
--     end if;
--   end $$;
