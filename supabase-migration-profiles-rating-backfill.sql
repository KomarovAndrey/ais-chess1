-- Проставить рейтинги 1500 по всем режимам существующим пользователям, у которых они не заданы.
-- Выполнить после supabase-migration-profiles-rating-3types.sql (добавляет колонки и handle_new_user с 1500).

update public.profiles
set
  rating_bullet = coalesce(rating_bullet, 1500),
  rating_blitz  = coalesce(rating_blitz, 1500),
  rating_rapid  = coalesce(rating_rapid, 1500)
where rating_bullet is null or rating_blitz is null or rating_rapid is null;
