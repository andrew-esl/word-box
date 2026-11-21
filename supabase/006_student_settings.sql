-- ============================================================================
-- Word Box: мова сайту для кожного учня (українська / російська)
-- Безпечна: нічого не видаляє й не чіпає cards, можна запускати повторно.
-- Де запускати: Supabase → SQL Editor → New query → вставити → Run. Один раз на весь проєкт.
-- Мову обирає викладач у картці учня. Учень лише читає свою.
-- ============================================================================

create table if not exists public.student_settings (
  user_email text primary key check (user_email = lower(user_email)),
  lang       text not null default 'uk' check (lang in ('uk', 'ru')),
  updated_at timestamptz not null default now()
);

alter table public.student_settings enable row level security;

drop policy if exists "Student reads own settings" on public.student_settings;
create policy "Student reads own settings"
  on public.student_settings for select
  using ((select auth.jwt() ->> 'email') = user_email);

drop policy if exists "Teacher reads all settings" on public.student_settings;
create policy "Teacher reads all settings"
  on public.student_settings for select
  using (public.is_teacher());

drop policy if exists "Teacher inserts settings" on public.student_settings;
create policy "Teacher inserts settings"
  on public.student_settings for insert
  with check (public.is_teacher());

drop policy if exists "Teacher updates settings" on public.student_settings;
create policy "Teacher updates settings"
  on public.student_settings for update
  using      (public.is_teacher())
  with check (public.is_teacher());

-- Перевірка: має показати 4 політики (2 select, insert, update)
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'student_settings' order by cmd, policyname;
