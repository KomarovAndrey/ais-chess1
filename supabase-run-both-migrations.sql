-- Выполнить в Supabase: SQL Editor → New query → вставить весь файл → Run.
-- 1) Колонка moves для истории ходов и PGN
-- 2) Таблицы турниров
-- 3) Рейтинг без входа (anon читает profiles)

-- 1. История ходов в games
alter table public.games
  add column if not exists moves jsonb not null default '[]'::jsonb;
comment on column public.games.moves is 'Array of UCI moves, e.g. ["e2e4","e7e5"]';

-- 2. Турниры
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'started', 'finished')),
  format text not null default 'round_robin'
    check (format in ('round_robin', 'swiss')),
  created_by uuid references auth.users(id) on delete set null,
  max_players integer,
  starts_at timestamptz
);

create table if not exists public.tournament_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;

create policy tournaments_select_authenticated
  on public.tournaments for select to authenticated using (true);

create policy tournaments_insert_authenticated
  on public.tournaments for insert to authenticated with check (true);

create policy tournament_players_select_authenticated
  on public.tournament_players for select to authenticated using (true);

create policy tournament_players_insert_own
  on public.tournament_players for insert to authenticated
  with check (user_id = auth.uid());

create policy tournament_players_delete_own
  on public.tournament_players for delete to authenticated
  using (user_id = auth.uid());

-- 3. Рейтинг без входа: анонимы могут читать профили (страница /ratings)
drop policy if exists profiles_select_public_anon on public.profiles;
create policy profiles_select_public_anon
  on public.profiles for select
  to anon
  using (true);
