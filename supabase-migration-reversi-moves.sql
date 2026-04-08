-- Reversi: хранить историю ходов для просмотра партии.
-- Каждый элемент: { "row": 0-7, "col": 0-7, "player": "black"|"white" }

alter table public.reversi_games
  add column if not exists moves jsonb not null default '[]';

comment on column public.reversi_games.moves is 'Array of { row, col, player } for each move in order';
