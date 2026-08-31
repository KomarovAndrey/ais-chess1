-- Расширить queue_order до 7 (для Robo; Lumo в приложении по-прежнему 1–5).
-- Выполнить в Supabase SQL Editor, если уже есть ограничение <= 5.

begin;

alter table public.child_program_ratings
  drop constraint if exists child_program_ratings_queue_order_check;

alter table public.child_program_ratings
  add constraint child_program_ratings_queue_order_check
  check (queue_order is null or (queue_order >= 1 and queue_order <= 7));

commit;
