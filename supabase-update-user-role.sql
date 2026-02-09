-- Назначить роль admin пользователю komarov_a
-- Администраторы имеют полный доступ к Soft Skills (оценка и экспорт)

UPDATE profiles
SET role = 'admin'
WHERE username = 'komarov_a';

-- Проверить результат
SELECT id, username, display_name, role
FROM profiles
WHERE username = 'komarov_a';
