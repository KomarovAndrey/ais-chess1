-- Таблица "дети" + комментарии учителей/админов
-- Выполнить в Supabase: SQL Editor → New query → вставить весь файл → Run.

-- 0) helper: проверить роль текущего пользователя
create or replace function public.is_teacher_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'admin')
  );
$$;

-- 1) дети
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_name text,
  full_name text not null,
  class_name text
);

alter table public.children
  add column if not exists team_name text;

create index if not exists children_full_name_idx on public.children using gin (to_tsvector('simple', full_name));
create index if not exists children_team_name_idx on public.children(team_name);

alter table public.children enable row level security;

drop policy if exists children_select_teacher_admin on public.children;
create policy children_select_teacher_admin
  on public.children for select
  to authenticated
  using (public.is_teacher_or_admin());

drop policy if exists children_insert_teacher_admin on public.children;
create policy children_insert_teacher_admin
  on public.children for insert
  to authenticated
  with check (public.is_teacher_or_admin());

drop policy if exists children_update_teacher_admin on public.children;
create policy children_update_teacher_admin
  on public.children for update
  to authenticated
  using (public.is_teacher_or_admin())
  with check (public.is_teacher_or_admin());

drop policy if exists children_delete_teacher_admin on public.children;
create policy children_delete_teacher_admin
  on public.children for delete
  to authenticated
  using (public.is_teacher_or_admin());

-- 2) комментарии по детям (много комментариев от разных пользователей)
-- Общие комментарии по ребёнку больше не используются: комментарии ведутся внутри дисциплин.
-- Если таблица `public.child_comments` уже существует в базе, удалите её через отдельную миграцию.

