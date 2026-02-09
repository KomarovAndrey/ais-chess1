-- Миграция: уникальный логин (username) в профилях и публичное чтение для поиска/профиля
-- Выполнить в Supabase: SQL Editor → вставить → Run (после основного supabase-schema-profiles.sql).

-- 1) Добавить колонку username (уникальная, для ссылки /@/username и поиска)
alter table public.profiles
  add column if not exists username text unique;

create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

comment on column public.profiles.username is 'Уникальный логин пользователя (латиница, цифры, подчёркивание).';

-- 2) Backfill: заполнить username из auth.users для существующих пользователей
update public.profiles p
set username = lower(trim(
  (select raw_user_meta_data->>'username' from auth.users u where u.id = p.id)
))
where p.username is null
  and exists (select 1 from auth.users u where u.id = p.id and (u.raw_user_meta_data->>'username') is not null and trim(u.raw_user_meta_data->>'username') <> '');

-- 3) Политика: авторизованные пользователи могут читать id, username, display_name (и bio) других для поиска и публичного профиля
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public
  on public.profiles for select
  to authenticated
  using (true);

-- 4) Триггер: при регистрации записывать username и display_name из raw_user_meta_data
create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta_username text;
begin
  meta_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  if meta_username is not null then
    meta_username := lower(meta_username);
  end if;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    meta_username,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- 5) Функция для проверки доступности логина (вызов без авторизации, возвращает только true/false)
create or replace function public.username_available(check_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := lower(trim(check_username));
  if normalized is null or length(normalized) < 3 or length(normalized) > 30 then
    return false;
  end if;
  return not exists (select 1 from public.profiles where lower(username) = normalized);
end;
$$;

comment on function public.username_available(text) is 'Проверка доступности логина для регистрации. Вызывать от anon.';

grant execute on function public.username_available(text) to anon;
grant execute on function public.username_available(text) to authenticated;
