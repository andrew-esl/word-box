-- ============================================================================
-- Word Box: прогрес тренажера неправильних дієслів
-- Безпечна: нічого не видаляє, можна запускати повторно.
-- Де запускати: Supabase → SQL Editor → New query → вставити → Run.
-- Запускати ПІСЛЯ 000 і 001. Запускається ОДИН РАЗ на весь проєкт.
--
-- Навіщо: прогрес тренажера живе в акаунті учня, а не в localStorage одного телефона,
-- і викладач його бачить. Самі дієслова (форми, рівні, переклади) у базі НЕ зберігаються:
-- вони вбудовані в застосунок і однакові для всіх. Тут лише те, як учень їх знає.
-- Картки (cards), журнал днів (study_days) і решта таблиць не чіпаються.
--
-- Один рядок = одне дієслово одного учня. Рядок з'являється, коли учень уперше
-- відповів на це дієслово. Бл. 230 дієслів × ~100 байтів ≈ 23 КБ на учня.
-- ============================================================================

create table if not exists public.irregular_progress (
  -- Ключ «пошта|інфінітив»: один рядок на учня й дієслово. Текстовий, а не складений,
  -- бо застосунок робить upsert по одному полю (так само, як у study_days).
  id          text primary key,
  user_email  text not null,
  verb        text not null,                       -- інфінітив малими літерами: "bind"
  box         smallint not null default 0,         -- коробка повторення: 0 (нове) … 5 (засвоєно)
  correct     integer not null default 0,          -- скільки разів відповів правильно
  wrong       integer not null default 0,          -- скільки разів помилився
  due_at      timestamptz,                         -- коли повторити
  last_at     timestamptz,                         -- остання відповідь
  updated_at  timestamptz not null default now(),
  constraint irregular_progress_box_range check (box between 0 and 5),
  constraint irregular_progress_email_verb unique (user_email, verb)
);

create index if not exists irregular_progress_email_idx on public.irregular_progress (user_email, due_at);

alter table public.irregular_progress enable row level security;

-- Учень: лише свої дієслова, і читає, і пише
drop policy if exists "Student reads own irregular" on public.irregular_progress;
create policy "Student reads own irregular"
  on public.irregular_progress for select
  using ((select auth.jwt() ->> 'email') = user_email);

drop policy if exists "Student writes own irregular" on public.irregular_progress;
create policy "Student writes own irregular"
  on public.irregular_progress for insert
  with check ((select auth.jwt() ->> 'email') = user_email);

drop policy if exists "Student updates own irregular" on public.irregular_progress;
create policy "Student updates own irregular"
  on public.irregular_progress for update
  using      ((select auth.jwt() ->> 'email') = user_email)
  with check ((select auth.jwt() ->> 'email') = user_email);

-- Викладач: бачить прогрес усіх учнів (лише читання)
drop policy if exists "Teacher reads all irregular" on public.irregular_progress;
create policy "Teacher reads all irregular"
  on public.irregular_progress for select
  using (public.is_teacher());

-- Перевірка: мають бути 4 політики
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'irregular_progress' order by cmd, policyname;
