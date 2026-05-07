-- ============================================================
-- 013 — Discussion RLS fix: allow soft-deleted messages to remain
-- visible (UI renders them as "Message supprimé"), and make UPDATE
-- WITH CHECK explicit so the soft-delete UPDATE no longer trips on
-- the implicit USING-as-WITH-CHECK fallback combined with the SELECT
-- filter on deleted_at.
-- ============================================================

-- SELECT — drop deleted_at filter (UI handles "supprimé" placeholder)
drop policy if exists "Authenticated users can view active messages"
  on public.discussion_messages;

create policy "Authenticated users can view messages"
  on public.discussion_messages
  for select using (auth.role() = 'authenticated');

-- UPDATE — explicit WITH CHECK so PostgreSQL doesn't fall back to USING
-- combined with other policies' implicit checks
drop policy if exists "Authors can update their messages"
  on public.discussion_messages;

create policy "Authors can update their messages"
  on public.discussion_messages
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
