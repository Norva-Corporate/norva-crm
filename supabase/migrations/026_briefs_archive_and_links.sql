-- ============================================================
-- 026 — Brief tokens & briefs: archivage + liaison CRM
-- ============================================================
-- Étend la migration 025 avec :
--   - Soft delete via `archived_at` (le DELETE physique reste possible
--     via service_role, mais l'UI filtre désormais sur archived_at IS NULL)
--   - Liaison aux tables contacts / companies pour cohérence CRM-wide.
--     Les snapshots texte (prospect_nom/email/entreprise) sont conservés
--     pour l'historique au cas où le contact serait modifié/supprimé.
-- ============================================================

-- ── brief_tokens ────────────────────────────────────────────
alter table public.brief_tokens
  add column archived_at  timestamptz,
  add column archived_by  uuid references public.profiles(id) on delete set null,
  add column contact_id   uuid references public.contacts(id)  on delete set null,
  add column company_id   uuid references public.companies(id) on delete set null;

create index brief_tokens_archived_idx
  on public.brief_tokens(archived_at)
  where archived_at is null;

create index brief_tokens_contact_idx on public.brief_tokens(contact_id);
create index brief_tokens_company_idx on public.brief_tokens(company_id);

-- L'index partiel `active` créé en 025 inclut implicitement `used = false`
-- mais doit aussi exclure les archivés. On le recrée.
drop index if exists public.brief_tokens_active_idx;
create index brief_tokens_active_idx
  on public.brief_tokens(expires_at)
  where used = false and archived_at is null;

-- ── briefs ──────────────────────────────────────────────────
alter table public.briefs
  add column archived_at  timestamptz,
  add column archived_by  uuid references public.profiles(id) on delete set null,
  add column contact_id   uuid references public.contacts(id)  on delete set null,
  add column company_id   uuid references public.companies(id) on delete set null;

create index briefs_archived_idx
  on public.briefs(archived_at)
  where archived_at is null;

create index briefs_contact_idx on public.briefs(contact_id);
create index briefs_company_idx on public.briefs(company_id);
