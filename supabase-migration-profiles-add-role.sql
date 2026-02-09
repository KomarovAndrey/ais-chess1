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
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'student'  -- По умолчанию все новые пользователи — студенты
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Индекс для быстрого поиска по ролям
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

COMMENT ON COLUMN profiles.role IS 'Роль пользователя: student (ученик), teacher (учитель), admin (администратор)';
