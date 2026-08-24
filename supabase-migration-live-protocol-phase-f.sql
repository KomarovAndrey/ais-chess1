-- Phase F: spectators / TV, in-game chat, presence
-- Run AFTER games schema + integrity + matchmaking

-- 1) Spectators: authenticated users can read active/aborted games (TV + watch)
drop policy if exists games_select_active_public on public.games;
create policy games_select_active_public
  on public.games for select
  to authenticated
  using (status in ('active', 'aborted', 'waiting', 'finished'));

-- 2) Presence on profiles
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

alter table public.profiles
  add column if not exists current_game_id uuid references public.games(id) on delete set null;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);

-- Heartbeat: update own presence (online + optional in-game)
create or replace function public.heartbeat_presence(p_game_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
  set
    last_seen_at = now(),
    current_game_id = p_game_id
  where id = v_me;
end;
$$;

revoke all on function public.heartbeat_presence(uuid) from public;
grant execute on function public.heartbeat_presence(uuid) to authenticated;

-- 3) In-game chat
create table if not exists public.game_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists game_messages_game_created_idx
  on public.game_messages (game_id, created_at desc);

alter table public.game_messages enable row level security;

drop policy if exists game_messages_select on public.game_messages;
create policy game_messages_select
  on public.game_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_messages.game_id
        and g.status in ('waiting', 'active', 'finished', 'aborted')
    )
  );

drop policy if exists game_messages_select_anon on public.game_messages;
create policy game_messages_select_anon
  on public.game_messages for select
  to anon
  using (
    exists (
      select 1 from public.games g
      where g.id = game_messages.game_id
        and g.status in ('waiting', 'active', 'finished', 'aborted')
    )
  );

drop policy if exists game_messages_insert on public.game_messages;
create policy game_messages_insert
  on public.game_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.games g
      where g.id = game_id
        and g.status in ('waiting', 'active')
    )
  );

-- Realtime for chat
do $$
begin
  alter publication supabase_realtime add table public.game_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

comment on table public.game_messages is 'In-game chat (Phase F).';
comment on column public.profiles.last_seen_at is 'Presence heartbeat (Phase F).';
comment on column public.profiles.current_game_id is 'Active game for in-game presence (Phase F).';
