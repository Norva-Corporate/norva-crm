-- ============================================================
-- 028 — Lien projet → brief source
-- ============================================================
-- Quand un projet est créé via "Créer un projet depuis ce brief"
-- (action createProjectFromBrief), on garde une référence FK pour
-- pouvoir afficher un lien "Brief source" sur la fiche projet et
-- permettre au commercial de re-consulter / télécharger le brief
-- d'origine à tout moment.
--
-- ON DELETE SET NULL : si le brief est archivé/supprimé, le projet
-- reste mais perd juste sa référence (le snapshot historique du
-- brief reste de toute façon protégé par notre soft-delete).
-- ============================================================

alter table public.projects
  add column brief_id uuid references public.briefs(id) on delete set null;

create index projects_brief_idx on public.projects(brief_id);
