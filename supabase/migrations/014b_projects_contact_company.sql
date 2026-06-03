-- ============================================================
-- 014b — Direct contact + company link on projects
-- ============================================================
-- Note historique : ce fichier portait à l'origine le numéro 014,
-- en collision avec `014_custom_fields.sql`. Renommé en `014b` pour
-- préserver l'ordre chronologique sans conflit visuel (l'ordre
-- d'exécution Supabase suit le tri lexicographique : 014b vient bien
-- juste après 014).
--
-- La migration a été appliquée en prod hors du tracker Supabase à
-- l'époque (les colonnes/FK/index existent déjà). Comme elle est
-- idempotente (add column if not exists + create index if not exists),
-- une éventuelle réexécution sur un environnement frais reproduira
-- exactement le même schéma sans casser la prod.
--
-- Adds optional contact_id / company_id FK columns on projects
-- so a project can be linked directly to a contact and a company,
-- independently of any deal it may be related to.
-- ============================================================

alter table public.projects
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists projects_contact_id_idx on public.projects(contact_id);
create index if not exists projects_company_id_idx on public.projects(company_id);
