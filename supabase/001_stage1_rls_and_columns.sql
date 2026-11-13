-- ============================================================================
-- Word Box: права учня на власні картки.
-- Безпечна: нічого не видаляє, можна запускати повторно. Запускати ПІСЛЯ 000.
-- ============================================================================

-- Учень бачить і змінює лише свої слова (прогрес повторення пишеться оновленням).
drop policy if exists "Users can view own cards" on public.cards;
create policy "Users can view own cards"
  on public.cards for select
  using ((select auth.jwt() ->> 'email') = user_email);

drop policy if exists "Users can update own cards" on public.cards;
create policy "Users can update own cards"
  on public.cards for update
  using      ((select auth.jwt() ->> 'email') = user_email)
  with check ((select auth.jwt() ->> 'email') = user_email);

-- Учень може видаляти власні слова. Без цієї політики кнопка «Видалити» мовчки
-- нічого не видаляла б (0 рядків, без помилки).
drop policy if exists "Users can delete own cards" on public.cards;
create policy "Users can delete own cards"
  on public.cards for delete
  using ((select auth.jwt() ->> 'email') = user_email);

-- Учень може додавати слова собі (наприклад, згенеровані ШІ). Лише з власною поштою:
-- чужому учню додати слова неможливо. Якщо слова додаєш лише ти, закоментуй блок і запусти:
--   drop policy if exists "Users can insert own cards" on public.cards;
drop policy if exists "Users can insert own cards" on public.cards;
create policy "Users can insert own cards"
  on public.cards for insert
  with check ((select auth.jwt() ->> 'email') = user_email);

-- Перевірка: мають бути політики select, update, delete, insert
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'cards' order by cmd;
