-- Migration 048 — supprimer le champ `notes` simple sur
-- contacts / companies / deals / lead_imports.
--
-- Pourquoi : ce champ TEXT unique était édité depuis plusieurs UI
-- (ContactDetail, CompanyDetail, drawers, DealDrawer "Activité")
-- mais chaque sauvegarde ÉCRASAIT la précédente. Les utilisateurs
-- pensaient "ajouter" des notes alors qu'ils remplaçaient l'ancienne.
-- L'historique structuré (table `activities`) est désormais le seul
-- canal pour les notes libres — append-only, daté, attribué.
--
-- Migration des données : chaque `notes` non vide est copiée dans
-- `activities` avec type='note' avant la suppression de la colonne.
-- `invoices.notes` est CONSERVÉ — il sert au champ "Notes" du PDF
-- de facture et n'est pas concerné par le doublon UI.

begin;

-- 1) Migrer les notes existantes vers activities
insert into public.activities (type, entity_type, entity_id, payload, created_by, created_at)
select 'note', 'contact', id, jsonb_build_object('body', trim(notes)), created_by, now()
from public.contacts
where notes is not null and trim(notes) <> '';

insert into public.activities (type, entity_type, entity_id, payload, created_by, created_at)
select 'note', 'company', id, jsonb_build_object('body', trim(notes)), created_by, now()
from public.companies
where notes is not null and trim(notes) <> '';

insert into public.activities (type, entity_type, entity_id, payload, created_by, created_at)
select 'note', 'deal', id, jsonb_build_object('body', trim(notes)), created_by, now()
from public.deals
where notes is not null and trim(notes) <> '';

insert into public.activities (type, entity_type, entity_id, payload, created_by, created_at)
select 'note', 'lead_import', id, jsonb_build_object('body', trim(notes)), processed_by, now()
from public.lead_imports
where notes is not null and trim(notes) <> '';

-- 2) Drop colonnes
alter table public.contacts     drop column notes;
alter table public.companies    drop column notes;
alter table public.deals        drop column notes;
alter table public.lead_imports drop column notes;

commit;
