-- Phase D: Задачи (tactical puzzles) — DB, puzzle rating, attempts
-- Run in Supabase SQL Editor after matchmaking migration.

-- 1) Puzzle rating on profiles
alter table public.profiles
  add column if not exists rating_puzzle integer not null default 1500;

comment on column public.profiles.rating_puzzle is 'Рейтинг Задач (Elo), старт 1500.';

-- 2) Puzzles catalog
create table if not exists public.puzzles (
  id text primary key,
  fen text not null,
  moves text[] not null,
  themes text[] not null default '{}',
  rating integer not null default 1500,
  popularity integer not null default 0,
  created_at timestamptz not null default now(),
  check (cardinality(moves) >= 1)
);

create index if not exists puzzles_rating_idx on public.puzzles (rating);
create index if not exists puzzles_themes_gin on public.puzzles using gin (themes);

alter table public.puzzles enable row level security;

drop policy if exists puzzles_select_all on public.puzzles;
create policy puzzles_select_all
  on public.puzzles for select
  to anon, authenticated
  using (true);

-- Service role / admin inserts via SQL seed; no public write

-- 3) Attempts (optional history)
create table if not exists public.puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null references public.puzzles(id) on delete cascade,
  success boolean not null,
  rating_before integer,
  rating_after integer,
  puzzle_rating_before integer,
  puzzle_rating_after integer,
  created_at timestamptz not null default now()
);

create index if not exists puzzle_attempts_user_created
  on public.puzzle_attempts (user_id, created_at desc);

alter table public.puzzle_attempts enable row level security;

drop policy if exists puzzle_attempts_select_own on public.puzzle_attempts;
create policy puzzle_attempts_select_own
  on public.puzzle_attempts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists puzzle_attempts_insert_own on public.puzzle_attempts;
create policy puzzle_attempts_insert_own
  on public.puzzle_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 4) Elo update for puzzle attempt (player + puzzle)
create or replace function public.apply_puzzle_result(
  p_puzzle_id text,
  p_success boolean
)
returns table (
  user_rating integer,
  puzzle_rating integer,
  user_delta integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user_r int;
  v_puz_r int;
  v_elo_k int := 32;
  v_score numeric;
  v_expected numeric;
  v_new_user int;
  v_new_puz int;
  v_delta int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select rating into v_puz_r from puzzles where id = p_puzzle_id for update;
  if v_puz_r is null then
    raise exception 'puzzle_not_found';
  end if;

  select coalesce(rating_puzzle, 1500) into v_user_r
  from profiles where id = v_uid for update;

  if v_user_r is null then
    raise exception 'profile_required';
  end if;

  v_score := case when p_success then 1.0 else 0.0 end;
  v_expected := 1.0 / (1.0 + power(10, (v_puz_r - v_user_r)::numeric / 400));
  v_new_user := round(v_user_r + v_elo_k * (v_score - v_expected));
  v_new_puz := round(v_puz_r + v_elo_k * ((1.0 - v_score) - (1.0 - v_expected)));
  v_delta := v_new_user - v_user_r;

  update profiles set rating_puzzle = v_new_user where id = v_uid;
  update puzzles
  set rating = v_new_puz,
      popularity = popularity + 1
  where id = p_puzzle_id;

  insert into puzzle_attempts (
    user_id, puzzle_id, success,
    rating_before, rating_after,
    puzzle_rating_before, puzzle_rating_after
  ) values (
    v_uid, p_puzzle_id, p_success,
    v_user_r, v_new_user,
    v_puz_r, v_new_puz
  );

  user_rating := v_new_user;
  puzzle_rating := v_new_puz;
  user_delta := v_delta;
  return next;
end;
$$;

revoke all on function public.apply_puzzle_result(text, boolean) from public;
grant execute on function public.apply_puzzle_result(text, boolean) to authenticated;

-- 5) Seed curated задачи (idempotent upsert)
insert into public.puzzles (id, fen, moves, themes, rating) values
  ('mate1-1', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', array['h5f7'], array['mateIn1','mate'], 800),
  ('mate1-2', '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', array['e1e8'], array['mateIn1','backRank','mate'], 900),
  ('mate1-3', 'r1bqkbnr/pppp1Qpp/2n5/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4', array['e8f7'], array['mateIn1','defense'], 850),
  ('fork-1', 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4', array['c4f7'], array['fork','material'], 1000),
  ('fork-2', 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', array['f3e5'], array['fork','material'], 1100),
  ('pin-1', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', array['h5e5'], array['pin','material'], 1050),
  ('pin-2', 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', array['c4f7'], array['pin','fork'], 1150),
  ('capture-1', 'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3', array['c4d5'], array['capture','opening'], 950),
  ('discover-1', 'r2qkb1r/ppp2ppp/2n1bn2/3pp3/4P3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 6', array['d3e5'], array['discoveredAttack','material'], 1200),
  ('mate2-1', '2r3k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1', array['c1c8','g8h7','c8h8'], array['mateIn2','backRank','mate'], 1300),
  ('mate2-2', '6k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1', array['f3f7','g8h8','f7f8'], array['mateIn2','mate'], 1250),
  ('skewer-1', '8/8/1k6/8/8/8/1K6/1R6 w - - 0 1', array['b1b6'], array['skewer','endgame'], 1000),
  ('hanging-1', 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', array['f3e5'], array['hangingPiece','material'], 980),
  ('deflection-1', '6k1/5ppp/8/8/8/4Q3/5PPP/6K1 w - - 0 1', array['e3e8'], array['mateIn1','mate'], 900),
  ('zwischenzug-1', 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', array['c4f7','e8f7','f3e5'], array['zwischenzug','fork','material'], 1400),
  ('endgame-1', '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1', array['e2e4'], array['endgame','pawn'], 800),
  ('endgame-2', '8/5k2/8/8/8/8/5PPP/5RK1 w - - 0 1', array['f1f7'], array['endgame','mateIn1','mate'], 850),
  ('tactic-1', 'r1bqk2r/pppp1ppp/2n2n2/2b1p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 6 5', array['g5f7'], array['fork','material'], 1180),
  ('tactic-2', '2kr3r/ppp2ppp/2n5/3qp3/8/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 10', array['c3d5'], array['capture','material'], 1120),
  ('mate3-setup', '5rk1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', array['d1d8'], array['mateIn1','backRank','mate'], 920),
  ('queen-sac-1', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', array['h5f7'], array['sacrifice','mateIn1','mate'], 1000),
  ('knight-fork', 'rnbqkb1r/pppp1ppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3', array['f6e4'], array['fork','material'], 1080),
  ('rook-lift', '4r1k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', array['e1e8'], array['mateIn1','backRank','mate'], 880),
  ('double-check', 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', array['c4f7'], array['doubleCheck','mate'], 1220),
  ('quiet-move', '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', array['d1d8'], array['mateIn1','mate'], 860)
on conflict (id) do update set
  fen = excluded.fen,
  moves = excluded.moves,
  themes = excluded.themes,
  rating = excluded.rating;

-- rating_history category support for puzzle (optional rows)
-- Existing rating_history.category is text — puzzle entries allowed.
comment on table public.puzzles is 'Каталог шахматных задач (Задачи).';
