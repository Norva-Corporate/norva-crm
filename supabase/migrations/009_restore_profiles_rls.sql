-- ============================================================
-- 009 — Restore profiles RLS policies (forgotten in realignment)
-- ============================================================
-- The schema realignment migration ALTERED the profiles table
-- in place (vs DROP+CREATE for the other tables) and did not
-- recreate the SELECT/UPDATE policies, leaving the table with
-- RLS enabled but zero policies → default-deny for every user.
-- This migration restores the original 001 policies.
-- ============================================================

drop policy if exists "Users can view all profiles" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

create policy "Users can view all profiles" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Admins can update any profile" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
