-- Фото профиля: колонка avatar_url + Storage bucket avatars
-- Выполнить в Supabase: SQL Editor → вставить → Run.
-- Если бакет не создаётся через SQL: в Dashboard → Storage → New bucket → имя "avatars", Public = On.
-- Если фото загружается, но не отображается: убедитесь, что бакет avatars в Dashboard → Storage помечен как Public; затем перезапустите этот скрипт (обновится политика чтения для anon).

-- 1) Колонка для URL фото (публичный URL из Storage)
alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is 'Публичный URL фото профиля (Supabase Storage, bucket avatars).';

-- 2) Бакет avatars (создать в Dashboard → Storage → New bucket: avatars, Public)
-- Или через SQL (если доступно):
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 3) RLS: все могут читать (публичные аватарки), в т.ч. без входа (anon)
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- 4) Загрузка/обновление только в свой файл (имя объекта = auth.uid() + расширение)
drop policy if exists "avatars authenticated upload own" on storage.objects;
create policy "avatars authenticated upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

drop policy if exists "avatars authenticated update own" on storage.objects;
create policy "avatars authenticated update own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text)
  with check (bucket_id = 'avatars');

drop policy if exists "avatars authenticated delete own" on storage.objects;
create policy "avatars authenticated delete own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);
