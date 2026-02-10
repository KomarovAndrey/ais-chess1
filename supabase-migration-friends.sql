-- Заявки в друзья и список друзей (status = accepted)
-- Выполнить в Supabase: SQL Editor → вставить → Run.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);

create index if not exists friend_requests_from on public.friend_requests(from_user_id);
create index if not exists friend_requests_to on public.friend_requests(to_user_id);
create index if not exists friend_requests_status on public.friend_requests(status);

alter table public.friend_requests enable row level security;

-- Пользователь видит свои заявки (исходящие и входящие)
create policy friend_requests_select_own
  on public.friend_requests for select
  to authenticated
  using (
    auth.uid() = from_user_id or auth.uid() = to_user_id
  );

-- Создавать заявку может только от своего имени
create policy friend_requests_insert_own
  on public.friend_requests for insert
  to authenticated
  with check (auth.uid() = from_user_id);

-- Обновлять (принять/отклонить) может только получатель
create policy friend_requests_update_recipient
  on public.friend_requests for update
  to authenticated
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

-- Удалить заявку может отправитель или получатель
create policy friend_requests_delete_own
  on public.friend_requests for delete
  to authenticated
  using (
    auth.uid() = from_user_id or auth.uid() = to_user_id
  );

comment on table public.friend_requests is 'Заявки в друзья. status=accepted — друзья.';
