-- ============================================================
-- 022 — Traçabilité Lead → Deal
-- ============================================================
-- Ajoute une colonne `source_lead_id` sur `deals` pour retrouver
-- le lead d'origine quand un deal est créé via le bouton
-- "→ Créer deal" du kanban (action convertLeadToDeal).
-- ============================================================

alter table public.deals
  add column if not exists source_lead_id uuid
    references public.lead_imports(id) on delete set null;

create index if not exists deals_source_lead_id_idx
  on public.deals(source_lead_id)
  where source_lead_id is not null;
