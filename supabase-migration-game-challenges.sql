-- Вызовы (челленджи) на партию между друзьями + старт игры без ссылок
-- Выполнить в Supabase: SQL Editor → вставить → Run.

create table if not exists public.game_challenges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),

  creator_color text not null default 'random'
    check (creator_color in ('white', 'black', 'random')),

  time_control_seconds integer not null default 300,

  game_id uuid references public.games(id) on delete set null,
  responded_at timestamptz,

  check (from_user_id <> to_user_id)
);

-- Только один активный вызов между парой пользователей
create unique index if not exists game_challenges_unique_pending
  on public.game_challenges(from_user_id, to_user_id)
  where status = 'pending';

create index if not exists game_challenges_to_status
  on public.game_challenges(to_user_id, status, created_at desc);
create index if not exists game_challenges_from_status
  on public.game_challenges(from_user_id, status, created_at desc);

alter table public.game_challenges enable row level security;

drop policy if exists game_challenges_select_own on public.game_challenges;
create policy game_challenges_select_own
  on public.game_challenges for select
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists game_challenges_insert_own on public.game_challenges;
create policy game_challenges_insert_own
  on public.game_challenges for insert
  to authenticated
  with check (auth.uid() = from_user_id);

-- Получатель может менять статус (принять/отклонить)
drop policy if exists game_challenges_update_recipient on public.game_challenges;
create policy game_challenges_update_recipient
  on public.game_challenges for update
  to authenticated
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

-- Отправитель может отменить
drop policy if exists game_challenges_update_sender on public.game_challenges;
create policy game_challenges_update_sender
  on public.game_challenges for update
  to authenticated
  using (auth.uid() = from_user_id)
  with check (auth.uid() = from_user_id);

drop policy if exists game_challenges_delete_own on public.game_challenges;
create policy game_challenges_delete_own
  on public.game_challenges for delete
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

comment on table public.game_challenges is 'Вызовы друга на партию. Принятие создаёт игру и добавляет обоих игроков.';

-- Принять вызов: создать игру и добавить обоих игроков (без ссылок).
-- Возвращает game_id.
create or replace function public.accept_game_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid;
  v_to uuid;
  v_status text;
  v_creator_color text;
  v_time int;
  v_game_id uuid;
  v_white_id text;
  v_black_id text;
  v_now timestamptz := now();
  v_initial bigint;
begin
  -- Берём и блокируем строку вызова
  select from_user_id, to_user_id, status, creator_color, time_control_seconds
  into v_from, v_to, v_status, v_creator_color, v_time
  from public.game_challenges
  where id = p_challenge_id
  for update;

  if v_from is null then
    raise exception 'challenge_not_found';
  end if;

  -- Принимать может только получатель
  if v_to <> auth.uid() then
    raise exception 'forbidden';
  end if;

  if v_status <> 'pending' then
    raise exception 'challenge_not_pending';
  end if;

  v_initial := (v_time::bigint) * 1000;

  insert into public.games (
    status, fen, creator_color, time_control_seconds, active_color,
    started_at, winner, white_time_left, black_time_left, last_move_at
  ) values (
    'active', 'startpos', v_creator_color, v_time, 'w',
    v_now, null, v_initial, v_initial, v_now
  ) returning id into v_game_id;

  -- Назначаем стороны: цвет создателя вызова = from_user_id
  if v_creator_color = 'white' then
    v_white_id := v_from::text;
    v_black_id := v_to::text;
  elsif v_creator_color = 'black' then
    v_white_id := v_to::text;
    v_black_id := v_from::text;
  else
    if random() < 0.5 then
      v_white_id := v_from::text;
      v_black_id := v_to::text;
    else
      v_white_id := v_to::text;
      v_black_id := v_from::text;
    end if;
  end if;

  insert into public.game_players (game_id, side, player_id)
  values
    (v_game_id, 'white', v_white_id),
    (v_game_id, 'black', v_black_id);

  update public.game_challenges
  set status = 'accepted',
      game_id = v_game_id,
      responded_at = v_now
  where id = p_challenge_id;

  return v_game_id;
end;
$$;

grant execute on function public.accept_game_challenge(uuid) to authenticated;
grant execute on function public.accept_game_challenge(uuid) to service_role;

-- Realtime: добавить таблицу game_challenges в публикацию supabase_realtime (идемпотентно)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'game_challenges'
  ) then
    alter publication supabase_realtime add table public.game_challenges;
  end if;
end $$;

