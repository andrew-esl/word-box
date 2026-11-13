# Word Box: словниковий застосунок з інтервальним повторенням (англійська)

Один файл `index.html` (чистий JS, без збирання) + Supabase (база й вхід) + тести.
Адаптація застосунку Boîte à Mots (французька) під англійську.

## Швидкий старт (≈ 40 хвилин)

1. **Supabase.** На supabase.com створи **новий** безкоштовний проєкт (окремий від будь-яких інших).
2. **Пошта викладача.** Пошта викладача вже вписана в `supabase/000_setup.sql`; якщо потрібна інша, заміни її там
   (малими літерами). Ту саму встав у `index.html`, константа `ADMIN_EMAIL`. Пошти мають збігатися.
3. **SQL.** У Supabase → SQL Editor по черзі виконай файли з папки `supabase/`:
   `000` → `001` → `002` → `003` → `004`. Кожен можна запускати повторно.
4. **Ключі.** У `index.html` знайди `SUPABASE_URL` і `SUPABASE_KEY` і встав свої значення
   (Project Settings → API: Project URL і publishable/anon key). Ключ `service_role` НЕ вставляти ніколи.
5. **Користувачі.** Supabase → Authentication → Users → Add user: створи себе (пошта з кроку 2) і учнів
   (пошта + пароль, «Auto Confirm User» увімкнено).
6. **Публікація.** GitHub → новий репозиторій → завантаж файли → Settings → Pages → Deploy from a branch → main / root.
7. **Слова.** Увійди як викладач → «Учні» → обери учня → «Додати слова» і встав JSON
   (приклад у `docs/words-example.json`, промпт для ШІ у `docs/PROMPT-words.md`).

## Тести

`npm test` (потрібен Node 18+). Тести запускають справжній скрипт з `index.html` у підробленому DOM.
Запускай після кожної зміни: вони швидко ловлять поломки.

## Де що міняти

| Що | Де в `index.html` |
|---|---|
| Назва застосунку | `Word Box` (заголовок, екран входу, шапка) |
| Мова озвучення | `SPEECH_LANG`, `VOICE_LANG_RE`, `PREFERRED_VOICE_RE` (перед `refreshVoices`) |
| Частини мови (фільтри) | `POS_GROUPS` |
| Часи тренажера відмінювання | `CONJ_TENSES`, `CONJ_PRONOUNS` |
| Службові позначки `sb`, `sth` | `getTestableTerm`, `prepareSpeechText`, `CW_STOPWORDS` |
| Пошта викладача | `ADMIN_EMAIL` і `is_teacher()` у `supabase/000_setup.sql` |

Поле слова в базі й у JSON називається `term` (імпорт також розуміє `word`, `en`, `fr`).

## Дані

Слів у репозиторії немає: вони живуть у базі Supabase. Ключі в код не комітимо, окрім publishable (anon):
він публічний за задумом, а доступ до даних обмежують політики RLS з папки `supabase/`.
