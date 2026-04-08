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
  full_name text not null,
  class_name text
);

create index if not exists children_full_name_idx on public.children using gin (to_tsvector('simple', full_name));

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

-- 2) комментарии по детям (много комментариев от разных пользователей)
create table if not exists public.child_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  child_id uuid not null references public.children(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 4000)
);

create index if not exists child_comments_child_id_created_at_idx
  on public.child_comments(child_id, created_at desc);
create index if not exists child_comments_author_id_created_at_idx
  on public.child_comments(author_id, created_at desc);

alter table public.child_comments enable row level security;

drop policy if exists child_comments_select_teacher_admin on public.child_comments;
create policy child_comments_select_teacher_admin
  on public.child_comments for select
  to authenticated
  using (public.is_teacher_or_admin());

drop policy if exists child_comments_insert_teacher_admin_own on public.child_comments;
create policy child_comments_insert_teacher_admin_own
  on public.child_comments for insert
  to authenticated
  with check (public.is_teacher_or_admin() and author_id = auth.uid());

drop policy if exists child_comments_update_own on public.child_comments;
create policy child_comments_update_own
  on public.child_comments for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists child_comments_delete_own_or_admin on public.child_comments;
create policy child_comments_delete_own_or_admin
  on public.child_comments for delete
  to authenticated
  using (
    author_id = auth.uid()
    or (
      public.is_teacher_or_admin()
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

