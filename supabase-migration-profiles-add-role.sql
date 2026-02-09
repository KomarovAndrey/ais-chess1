-- Добавление поля role в таблицу profiles
-- Роли: student (по умолчанию), teacher, admin

-- 1. Добавить поле role (enum)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
  END IF;
END $$;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'student';

-- 2. Обновить функцию handle_new_user, чтобы она добавляла роль
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_username text;
BEGIN
  meta_username := nullif(trim(NEW.raw_user_meta_data->>'username'), '');
  IF meta_username IS NOT NULL THEN
    meta_username := lower(meta_username);
  END IF;
  
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    NEW.id,
    meta_username,
    coalesce(
      nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(NEW.raw_user_meta_data->>'username'), ''),
      nullif(trim(NEW.raw_user_meta_data->>'full_name'), '')
    ),
    'student'  -- По умолчанию все новые пользователи — студенты
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Индекс для быстрого поиска по ролям
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
