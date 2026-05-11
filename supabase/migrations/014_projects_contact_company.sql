-- ============================================================
-- 014 — Direct contact + company link on projects
-- ============================================================
-- Adds optional contact_id / company_id FK columns on projects
-- so a project can be linked directly to a contact and a company,
-- independently of any deal it may be related to.
--
-- Idempotent : add column if not exists + create index if not exists.
-- ============================================================

alter table public.projects
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists projects_contact_id_idx on public.projects(contact_id);
create index if not exists projects_company_id_idx on public.projects(company_id);
