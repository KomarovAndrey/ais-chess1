# AIS Chess (Next.js 15 + Supabase)

Школьная платформа: **Soft Skills** (оценки, рейтинги, команды) и **Reversi**.

## Стек

- Next.js 15 (App Router, `src/app`)
- React + TypeScript + Tailwind CSS
- Supabase (auth, Postgres, Realtime, RLS)
- Vitest (unit) + Playwright (smoke e2e)

## Маршруты

| Путь | Описание |
|------|----------|
| `/` | Главная |
| `/login`, `/register` | Авторизация |
| `/soft-skills`, `/soft-skills/[moduleId]` | Модули Soft Skills |
| `/soft-skills/analytics` | Аналитика (teacher/admin) |
| `/ratings` | Рейтинги Soft Skills |
| `/profile`, `/user/[username]` | Профиль (софты) |
| `/reversi` | Reversi vs CPU или по ссылке (с входом) |
| `/admin/reports` | Жалобы (admin) |

## Роли

- **student** — модули, профиль, self-ratings, игра
- **teacher** — + оценки, редактор команд, аналитика, список учеников
- **admin** — + жалобы, полный доступ staff API

## Production env

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (ходы, рейтинг, staff)
- `USE_DB_RATE_LIMIT=1` (рекомендуется на Vercel)
- `NEXT_PUBLIC_SITE_URL` (SEO)

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

Тесты:

```bash
npm test
npm run test:e2e   # Playwright smoke (нужен build или dev-сервер)
npm run audit:supabase
```

2. **Настройте ключи Supabase в `.env.local`** — без них авторизация (вход, регистрация, профиль) работать не будет. Создайте в корне проекта файл `.env.local` и укажите:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Значения возьмите в [Supabase Dashboard](https://supabase.com/dashboard) → ваш проект → **Settings** → **API** (Project URL и anon public key). Можно скопировать `.env.example` в `.env.local` и подставить свои ключи. Для staff API и rate limits также укажите **`SUPABASE_SERVICE_ROLE_KEY`** (тот же раздел API → `service_role`, секретный ключ). Добавьте его и в Vercel Environment Variables. Для SEO (корректные ссылки в robots.txt и sitemap) при необходимости укажите в `.env.local` переменную `NEXT_PUBLIC_SITE_URL` (полный URL сайта, например `https://your-domain.com`).

3. **Создайте таблицы в Supabase**:
   - Откройте [Supabase Dashboard](https://supabase.com/dashboard) → ваш проект.
   - Слева выберите **SQL Editor** → **New query**.
   - Выполните SQL-скрипты по порядку (каждый в отдельном запросе):
     1. `supabase-schema-profiles.sql` — таблица профилей пользователей
     2. `supabase-migration-profiles-username.sql` — username и функции
     3. `supabase-migration-profiles-add-role.sql` — роли (student/teacher/admin)
     4. `supabase-migration-live-protocol-phase-f.sql` — presence (last_seen_at)
     5. `supabase-migration-trust-phase-g.sql` — rate buckets, жалобы
     6. `supabase-migration-friends.sql` — заявки в друзья (опционально)
     7. `supabase-migration-reversi-games.sql` + `supabase-migration-reversi-moves.sql` — Reversi

   **Soft Skills** (выполнить по порядку):
     1. `supabase-migration-soft-skills-teams.sql`
     2. `supabase-migration-soft-skills-league-binding.sql`
     3. `supabase-migration-soft-skills-ratings.sql`
     4. `supabase-migration-soft-skills-disciplines.sql` — обязательно
     5. `supabase-migration-soft-skills-teacher-note.sql`
     6. `supabase-migration-soft-skills-self-ratings.sql`
     7. `supabase-migration-profiles-protect-sensitive.sql` — защита role/рейтингов, login RPC
     8. `supabase-migration-soft-skills-rls-tighten.sql` — ужесточение RLS entries/self-ratings

   Демо-данные для тестов: `npm run seed:soft-skills` (нужен `SUPABASE_SERVICE_ROLE_KEY` в `.env.local`).
   Проверка рейтингов: `node scripts/verify-soft-skills-ratings.mjs`.
   Аудит Supabase: `npm run audit:supabase`.

   Если раньше ставили **шахматы** (games/seeks/challenges): `supabase-drop-chess.sql`.
   Если раньше ставили **Задачи**: `supabase-drop-zadachi.sql`.
   Если раньше ставили **Турниры**: `supabase-drop-tournaments.sql`.

   В production обязателен `SUPABASE_SERVICE_ROLE_KEY` для staff API и rate limits.
   Рекомендуется в production: `USE_DB_RATE_LIMIT=1` — распределённый лимит через `rate_limit_buckets`.
   - Для каждого скрипта: скопируйте весь код из файла и вставьте в редактор, затем нажмите **Run** (или Ctrl+Enter).
   - Должно выполниться без ошибок. Схема подхватится автоматически.
   - Если в проекте раньше был Soft Skills: выполните `supabase-drop-soft-skills.sql`, чтобы удалить таблицы `children` / ratings.

4. Запустите dev-сервер:

```bash
npm run dev
```

5. Откройте `http://localhost:3000`.

6. **Логотип в шапке:** чтобы отображалась иконка школы (эмблема AIS), поместите файл `ais-emblem-color.png` в папку `public/`. Рекомендуемый размер изображения — не менее 80×80 px.

## Настройка Supabase: регистрация, подтверждение email и сброс пароля

Чтобы работали регистрация с подтверждением по почте и восстановление пароля, настройте проект в Supabase по шагам ниже.

### Шаг 1. Включить подтверждение email (Confirm email)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard) и выберите ваш проект.
2. В левом меню нажмите **Authentication** (Авторизация).
3. Откройте вкладку **Providers** (Провайдеры).
4. Найдите провайдер **Email** и нажмите на него (или на шестерёнку рядом).
5. Убедитесь, что **Email provider** включён (переключатель в положении «вкл»).
6. Включите опцию **Confirm email** — тогда после регистрации пользователю придёт письмо со ссылкой для активации аккаунта. Без активации вход будет недоступен.
7. Нажмите **Save** (Сохранить).

### Шаг 2. Настроить URL (Site URL и Redirect URLs)

1. В том же разделе **Authentication** в левом меню выберите **URL Configuration** (Настройка URL).
2. **Site URL** — основной адрес вашего сайта:
   - Для локальной разработки: `http://localhost:3000`
   - Для продакшена на Vercel: `https://ваш-проект.vercel.app` (подставьте реальный домен из Vercel).
   - Можно указать один основной URL. При необходимости его потом поменяете.
3. **Redirect URLs** — список разрешённых адресов, на которые Supabase может перенаправить пользователя после действия (подтверждение email, сброс пароля). **Обязательно** добавьте URL для подтверждения аккаунта (иначе ссылка из письма не откроется):
   - `http://localhost:3000/auth/callback` — подтверждение email локально.
   - `http://localhost:3000/reset-password` — сброс пароля локально.
   - `http://localhost:3000/**` — все пути на localhost (удобно для разработки).
   - `https://ваш-проект.vercel.app/auth/callback` — подтверждение email на продакшене (подставьте ваш домен).
   - `https://ваш-проект.vercel.app/reset-password` — сброс пароля на продакшене.
   - При желании: `https://ваш-проект.vercel.app/**` — все пути на продакшене.
4. Нажмите **Save**.

Важно: домен в Redirect URLs должен точно совпадать с тем, на котором открыт сайт (включая `http`/`https` и наличие/отсутствие `www`).

### Шаг 3. Настроить шаблоны писем (Email Templates)

1. В разделе **Authentication** выберите **Email Templates** (Шаблоны писем).
2. **Confirm signup** — письмо с подтверждением регистрации:
   - Откройте шаблон **Confirm signup**.
   - Поле **Subject** — тема письма, например: `Подтвердите регистрацию в AIS Chess`.
   - В **Message (HTML)** уже есть переменная `{{ .ConfirmationURL }}` — это ссылка для подтверждения. Можно изменить текст вокруг неё на русский, например: «Перейдите по ссылке, чтобы активировать аккаунт: {{ .ConfirmationURL }}».
   - Сохраните изменения.
3. **Reset password** — письмо для сброса пароля:
   - Откройте шаблон **Reset Password**.
   - **Subject** — например: `Сброс пароля AIS Chess`.
   - В тексте должна быть переменная `{{ .ConfirmationURL }}` — ссылка для смены пароля (ведёт на ваш сайт, например на `/reset-password`). Можно написать: «Перейдите по ссылке, чтобы задать новый пароль: {{ .ConfirmationURL }}».
   - Сохраните изменения.

После сохранения писем Supabase будет подставлять правильные ссылки (с учётом Site URL и Redirect URLs).

### Шаг 4. Проверка

- **Регистрация:** зарегистрируйте тестовый аккаунт — на email должно прийти письмо с подтверждением. Переход по ссылке активирует аккаунт.
- **Сброс пароля:** на странице входа нажмите «Забыли пароль?», введите email — должно прийти письмо со ссылкой. Переход по ссылке открывает страницу «Новый пароль» на вашем сайте; после смены пароля вход с новым паролем должен работать.

### Лимиты на письма (Rate Limits)

Supabase ограничивает число писем (регистрация, сброс пароля) в час. При превышении пользователь увидит ошибку «Email rate limit exceeded». Что сделать:

- **Проверить или увеличить лимиты:** в Supabase Dashboard откройте **Authentication** → **Rate Limits**. Там можно посмотреть текущие лимиты и при необходимости увеличить (если тариф это позволяет).
- **Если лимит исчерпан:** подождать около часа или использовать другой email для теста.

Пароли в Supabase хранятся только в виде хешей (не в открытом виде), это обеспечивается самой Supabase.

## Пошагово: выложить сайт в репозиторий на GitHub

### Шаг 1. Установить Git

- Скачайте установщик: [git-scm.com/download/win](https://git-scm.com/download/win)
- Установите, на шаге **PATH** выберите **"Git from the command line and also from 3rd-party software"**.
- Закройте и снова откройте терминал (или Cursor).

### Шаг 2. Открыть папку проекта в терминале

- В Cursor: меню **Terminal** → **New Terminal** (или `` Ctrl+` ``).
- Перейдите в папку проекта, если вы не в ней:
  ```bash
  cd c:\Users\Student\ais-chess
  ```

### Шаг 3. Создать локальный репозиторий и первый коммит

Выполните по очереди:

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Initial commit: AIS Chess"
```

После этого у вас появится папка `.git` и один коммит со всеми файлами проекта (кроме тех, что в `.gitignore`).

### Шаг 4. Создать репозиторий на GitHub

1. Откройте в браузере [github.com](https://github.com) и войдите в аккаунт.
2. Справа вверху нажмите **"+"** → **New repository**.
3. **Repository name:** например `ais-chess`.
4. **Public**.
5. **Не ставьте** галочки "Add a README", "Add .gitignore", "Choose a license" — в проекте уже есть README и .gitignore.
6. Нажмите **Create repository**.

### Шаг 5. Привязать удалённый репозиторий и отправить код

На странице нового репозитория GitHub будет блок **"…or push an existing repository from the command line"**. Выполните эти команды в терминале (подставьте вместо `ВАШ_ЛОГИН` свой логин GitHub):

```bash
git remote add origin https://github.com/ВАШ_ЛОГИН/ais-chess.git
```

```bash
git branch -M main
```

```bash
git push -u origin main
```

- Если попросят логин и пароль: в качестве пароля используйте **Personal Access Token** (не обычный пароль от аккаунта).
- Токен создаётся так: GitHub → **Settings** (вашего профиля) → **Developer settings** → **Personal access tokens** → **Generate new token** → права хотя бы `repo` → скопировать токен и вставить в поле пароля при `git push`.

После успешного `git push` код проекта появится на GitHub в репозитории `ais-chess`. Дальше можно деплоить на Vercel (см. раздел ниже).

## Деплой на Vercel

1. Убедитесь, что проект уже в GitHub (см. «Публикация на GitHub» выше).

2. Зайдите на [vercel.com](https://vercel.com), войдите через GitHub.

3. **Add New** → **Project** → выберите репозиторий `ais-chess` (или ваш логин/ais-chess). **Import**.

4. В настройках проекта добавьте **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` — URL проекта из Supabase (Settings → API).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key из Supabase (Settings → API).  
   Укажите их для окружений **Production**, **Preview** и **Development**.

5. Нажмите **Deploy**. Vercel соберёт Next.js и задеплоит. После сборки откроется ссылка вида `https://ais-chess-xxx.vercel.app`.

6. Таблицы в Supabase уже должны быть созданы (шаг 3 в «Быстрый старт»). На продакшене используется тот же Supabase проект — база общая.

7. **Опционально для SEO:** в Environment Variables добавьте `NEXT_PUBLIC_SITE_URL` — полный URL сайта (например `https://ais-chess-xxx.vercel.app`). Тогда в `robots.txt` и `sitemap.xml` будут подставляться правильные ссылки.

## SEO и технические настройки

- **robots.txt** — генерируется динамически из `src/app/robots.ts`. Правила: разрешена индексация публичных страниц; закрыты от индексации `/api/`, `/auth/`, страницы входа/регистрации/профиля и партий. Ссылка на sitemap подставляется из переменной `NEXT_PUBLIC_SITE_URL` (если не задана — используется заглушка `https://ais-chess.example.com`).
- **sitemap.xml** — генерируется из `src/app/sitemap.ts`. В карту входят публичные страницы: главная, `/soft-skills`, `/reversi`, `/ratings`, `/privacy`, `/terms`. Для корректных URL в sitemap задайте `NEXT_PUBLIC_SITE_URL` в `.env.local` (разработка) и в настройках проекта на Vercel (продакшен).
- **Сжатие (gzip):** включено в `next.config.mjs` (`compress: true`). При запуске через `next start` или на Vercel ответы сжимаются. Проверка: откройте сайт в браузере → DevTools → вкладка Network → выберите документ или крупный JS/CSS → во вкладке Headers ответа должно быть поле `Content-Encoding: gzip` (или `br` на части хостингов).
- **Скорость:** страница рейтингов кэшируется на 60 секунд (`revalidate = 60`). Тяжёлый компонент игры (`play-game`) подгружается динамически при открытии партии, чтобы не увеличивать размер основного бандла.

## Как обновить данные на сайте (пошагово)

Когда вы изменили код или контент и хотите, чтобы изменения появились на живом сайте (например, на Vercel):

1. **Сохраните все файлы** в редакторе (Ctrl+S).

2. **Откройте терминал** в папке проекта (в Cursor: Terminal → New Terminal). Перейдите в проект, если нужно:
   ```bash
   cd c:\Users\Student\ais-chess
   ```

3. **Посмотрите, что изменилось:**
   ```bash
   git status
   ```
   Будут видны изменённые и новые файлы.

4. **Добавьте все изменения в коммит:**
   ```bash
   git add .
   ```

5. **Создайте коммит с коротким описанием:**
   ```bash
   git commit -m "Описание изменений"
   ```
   Примеры: `"Исправлена форма регистрации"`, `"Обновлён текст на главной"`.

6. **Отправьте изменения на GitHub:**
   ```bash
   git push origin main
   ```
   Если попросят логин/пароль — используйте логин GitHub и **Personal Access Token** (не пароль от аккаунта).

7. **Дождитесь деплоя на Vercel** (1–3 минуты). Статус можно смотреть на [vercel.com](https://vercel.com) → ваш проект → вкладка **Deployments**. Когда сборка станет зелёной (**Ready**), сайт обновлён.

Итог: сохранили файлы → `git add .` → `git commit -m "..."` → `git push origin main` → сайт обновится автоматически.