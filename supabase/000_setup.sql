-- ============================================================================
-- Word Box: початкове налаштування бази (ЗАПУСКАТИ ПЕРШИМ, один раз на проєкт).
-- Безпечно: нічого не видаляє, можна запускати повторно.
-- Де запускати: Supabase → SQL Editor → New query → вставити → Run.
--
-- Що робить:
--   1) задає пошту викладача (єдине місце в SQL; усі політики викликають is_teacher());
--   2) створює таблицю cards (слова учнів + прогрес повторення);
-- Потім по черзі запускай 001 → 002 → 003 → 004.
-- ============================================================================

-- 1) ПОШТА ВИКЛАДАЧА (малими літерами). Та сама має стояти в index.html
--    (константа ADMIN_EMAIL). Якщо вони розійдуться, кабінет викладача не працюватиме.
create or replace function public.is_teacher()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'andreyantonov2@gmail.com'
$$;

-- 2) Таблиця слів. Один рядок = одна картка одного учня (user_email = пошта учня малими літерами).
create table if not exists public.cards (
  id                  uuid primary key default gen_random_uuid(),
  user_email          text not null check (user_email = lower(user_email)),
  term                text not null,                 -- слово або вираз англійською
  uk                  text not null default '',      -- переклад
  def                 text not null default '',      -- тлумачення англійською
  ex                  text not null default '',      -- приклад; слово в [дужках] підсвічується
  syn                 jsonb not null default '[]'::jsonb,  -- синоніми (масив рядків)
  conj                jsonb,                         -- форми дієслова за часами + context_quiz
  pos                 text not null default '',      -- частина мови (noun, verb, phrasal verb…)
  src                 text not null default 'Загальний',   -- тема
  status              text not null default 'new',
  added               date not null default current_date,
  iv                  numeric not null default 0,    -- інтервал повторення, днів
  ef                  numeric not null default 2.5,  -- коефіцієнт легкості
  r                   integer not null default 0,    -- успішних повторень поспіль
  l                   integer not null default 0,    -- скільки разів помилився
  due                 bigint not null default 0,     -- коли повторити (мс від епохи)
  t                   bigint not null default 0,     -- останнє повторення
  created_at          timestamptz not null default now()
);

create index if not exists cards_user_email_idx on public.cards (user_email);

alter table public.cards enable row level security;
