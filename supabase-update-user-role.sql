-- Назначить роль admin пользователю komarov_a

UPDATE profiles
SET role = 'admin'
WHERE username = 'komarov_a';

-- Проверить результат
SELECT id, username, display_name, role
FROM profiles
WHERE username = 'komarov_a';
