-- ============================================================
-- 003 — Migrate status enums to French (projects + invoices)
-- ============================================================
-- Drops the inline CHECK constraints, rewrites existing values,
-- rebuilds CHECK with French values, updates DEFAULTs.
--
-- Idempotent : re-running is a no-op once values are already FR
-- (UPDATE filters by old EN values, DROP IF EXISTS, etc.).
-- ============================================================

-- ------------------------------------------------------------
-- PROJECTS.status
-- planning  → en_attente
-- active    → en_cours
-- on_hold   → en_pause
-- completed → termine
-- cancelled → annule
-- ------------------------------------------------------------
alter table public.projects
  drop constraint if exists projects_status_check;

update public.projects
set status = case status
  when 'planning'  then 'en_attente'
  when 'active'    then 'en_cours'
  when 'on_hold'   then 'en_pause'
  when 'completed' then 'termine'
  when 'cancelled' then 'annule'
  else status
end
where status in ('planning', 'active', 'on_hold', 'completed', 'cancelled');

alter table public.projects
  alter column status set default 'en_attente';

alter table public.projects
  add constraint projects_status_check
  check (status in ('en_attente', 'en_cours', 'en_pause', 'termine', 'annule'));

-- ------------------------------------------------------------
-- INVOICES.status
-- draft     → brouillon
-- sent      → envoyee
-- paid      → payee
-- overdue   → en_retard
-- cancelled → annulee
-- ------------------------------------------------------------
alter table public.invoices
  drop constraint if exists invoices_status_check;

update public.invoices
set status = case status
  when 'draft'     then 'brouillon'
  when 'sent'      then 'envoyee'
  when 'paid'      then 'payee'
  when 'overdue'   then 'en_retard'
  when 'cancelled' then 'annulee'
  else status
end
where status in ('draft', 'sent', 'paid', 'overdue', 'cancelled');

alter table public.invoices
  alter column status set default 'brouillon';

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('brouillon', 'envoyee', 'payee', 'en_retard', 'annulee'));
