-- Предложение ничьей: флаг в таблице games
-- Выполнить в Supabase: SQL Editor → Run после основной схемы games.

alter table public.games
  add column if not exists draw_offer_from text;

comment on column public.games.draw_offer_from is 'player_id из game_players, который предложил ничью (null, если предложения нет).';

