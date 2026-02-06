# AIS Chess (Next.js 15 + Supabase)

Простой внутришкольный сайт для игры в шахматы.

## Стек

- Next.js 15 (App Router, `src/app`)
- React + TypeScript
- Tailwind CSS
- Собственный минимальный UI в стиле shadcn (компонент `Button`)
- Supabase для email/password авторизации
- `lucide-react` для иконок
- `chess.js` и `react-chessboard` для логики и отображения доски

## Страницы

- `/` — лендинг с описанием и кнопкой «Начать»
- `/login` — страница входа (email/password)
- `/register` — страница регистрации
- `/chess` — шахматная доска с выбором цвета и сложности

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env.local` в корне:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

3. **Создайте таблицы в Supabase** (иначе будет ошибка «Could not find the table public.games»):
   - Откройте [Supabase Dashboard](https://supabase.com/dashboard) → ваш проект.
   - Слева выберите **SQL Editor** → **New query**.
   - Скопируйте весь код из файла `supabase-schema-games.sql` в проекте и вставьте в редактор.
   - Нажмите **Run** (или Ctrl+Enter).
   - Должно выполниться без ошибок — появятся таблицы `games` и `game_players` и политики RLS. Схема подхватится автоматически.

4. Запустите dev-сервер:

```bash
npm run dev
```

5. Откройте `http://localhost:3000`.

## Пошагово: выложить сайт в репозиторий на GitHub

### Шаг 1. Установить Git

- Скачайте установщик: [git-scm.com/download/win](.https://git-scm.com/download/win)
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