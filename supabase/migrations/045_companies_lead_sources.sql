-- ============================================================
-- 045 — companies : conserver les sources lead (Google Maps + Société.com)
-- ============================================================
-- Quand un lead est converti en deal via convertLeadToDeal, l'entreprise
-- créée n'héritait que de {name, domain, created_by}. Tout le contexte
-- riche du lead (SIREN, place_id Google Maps, URL Maps) était laissé
-- dans lead_imports.raw_payload, devenant inaccessible depuis la fiche
-- entreprise.
--
-- 3 colonnes ajoutées (scope minimal "liens externes" — cf. plan F) :
--   - siren           : permet societe.com et pappers.fr
--   - place_id        : permet Google Maps via /maps/place/?q=place_id:<id>
--   - google_maps_url : URL canonique si fournie par le scraping
--
-- Le helper TS `buildExternalLinks` (cf. src/lib/external-links.ts)
-- reconstruit les URLs cliquables côté UI à partir de ces 3 valeurs.
--
-- Backfill : on remplit ces colonnes pour les entreprises déjà créées
-- via lead converti, en remontant à lead_imports.raw_payload.
-- ============================================================

alter table public.companies
  add column if not exists siren text,
  add column if not exists place_id text,
  add column if not exists google_maps_url text;

-- Index partiel sur siren pour de futurs use cases de dédup côté entreprises
-- (un même SIREN ne devrait pas apparaître plusieurs fois en base).
create index if not exists companies_siren_idx
  on public.companies(siren)
  where siren is not null;

comment on column public.companies.siren is
  'SIREN INSEE (9 chiffres). Source : lead_imports.raw_payload.siren. Permet de construire les URLs societe.com et pappers.fr.';
comment on column public.companies.place_id is
  'Google Places ID. Permet de reconstruire un lien Maps via /maps/place/?q=place_id:<id>.';
comment on column public.companies.google_maps_url is
  'URL Google Maps canonique si fournie par le scraping.';

-- ------------------------------------------------------------
-- Backfill historique
-- ------------------------------------------------------------
-- Pour chaque company créée via lead converti (lead_imports.company_id
-- NOT NULL), retrouve le lead le plus récemment traité et copie les 3
-- champs depuis son raw_payload. `coalesce(c.X, ls.X)` n'écrase jamais
-- une valeur déjà saisie manuellement.
with lead_sources as (
  select distinct on (li.company_id)
    li.company_id,
    li.raw_payload->>'siren' as siren,
    li.raw_payload->>'place_id' as place_id,
    li.raw_payload->>'google_maps_url' as google_maps_url
  from public.lead_imports li
  where li.company_id is not null
    and li.raw_payload is not null
  order by li.company_id, li.processed_at desc nulls last
)
update public.companies c
set
  siren = coalesce(c.siren, ls.siren),
  place_id = coalesce(c.place_id, ls.place_id),
  google_maps_url = coalesce(c.google_maps_url, ls.google_maps_url)
from lead_sources ls
where c.id = ls.company_id
  and (
    (c.siren is null and ls.siren is not null)
    or (c.place_id is null and ls.place_id is not null)
    or (c.google_maps_url is null and ls.google_maps_url is not null)
  );
