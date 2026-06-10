-- ============================================================
-- 050 — lead_imports : liens externes personnalisés
-- ============================================================
-- Permet de saisir manuellement des liens externes sur un lead, sous
-- la forme { "label": "Facebook", "url": "https://facebook.com/..." }.
-- Distinct des liens AUTO-dérivés de raw_payload (Google Maps,
-- Société.com, Pappers…) reconstruits par src/lib/external-links.ts.
--
-- Stockage : tableau JSONB, défaut '[]' (jamais null → simplifie le
-- rendu côté UI : `lead.external_links ?? []` reste défensif mais la
-- colonne contient toujours au minimum un tableau vide).
-- ============================================================

alter table public.lead_imports
  add column if not exists external_links jsonb not null default '[]'::jsonb;

comment on column public.lead_imports.external_links is
  'Liens externes saisis manuellement : [{"label":"Facebook","url":"https://..."}]. Distinct des liens auto-dérivés de raw_payload.';
