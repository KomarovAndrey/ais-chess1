-- Профили пользователей (имя, личная информация)
-- Выполнить в Supabase: SQL Editor → вставить → Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Публичное чтение для поиска и профиля (id, username, display_name, bio)
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public
  on public.profiles for select to authenticated using (true);

-- Создать запись профиля при первой регистрации (username + display_name из meta)
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

-- Проверка доступности логина (для регистрации, вызов без авторизации)
create or replace function public.username_available(check_username text)
returns boolean language plpgsql security definer set search_path = public as $$
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
grant execute on function public.username_available(text) to anon;
grant execute on function public.username_available(text) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
