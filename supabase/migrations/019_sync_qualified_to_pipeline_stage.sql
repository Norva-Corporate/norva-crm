-- ============================================================
-- 019 — Migrer les leads `qualified` legacy vers pipeline_stage='to_contact'
-- ============================================================
-- Les leads qualifiés via l'ancien workflow (bouton "Qualifier" dans
-- le drawer) ont `status='qualified'` mais `pipeline_stage='brut'`
-- (default de la migration 017). On les bascule en `to_contact` pour
-- que la vue liste et la vue kanban soient cohérentes :
--
--   À traiter (pending) <-> colonnes Brut + Vérifié
--   Qualifiés (qualified) <-> colonnes À contacter + Contacté + En discussion
--
-- Les leads qui ont déjà été drag-placés dans une colonne kanban
-- (pipeline_stage != 'brut') ne sont PAS touchés.
-- ============================================================

update public.lead_imports
set pipeline_stage = 'to_contact'
where status = 'qualified'
  and pipeline_stage = 'brut';
