-- ============================================================
-- 018 — Élargir les index kanban pour inclure 'qualified'
-- ============================================================
-- Le kanban affiche maintenant les leads pending ET qualified
-- (les deux états "vivants" du funnel, avant les terminaux
-- converted/dismissed/duplicate). On élargit les filtres
-- d'index pour rester performant.
-- ============================================================

drop index if exists public.lead_imports_pipeline_stage_idx;
drop index if exists public.lead_imports_quality_score_idx;

create index lead_imports_pipeline_stage_idx
  on public.lead_imports(pipeline_stage, imported_at desc)
  where status in ('pending', 'qualified');

create index lead_imports_quality_score_idx
  on public.lead_imports(quality_score desc)
  where quality_score is not null and status in ('pending', 'qualified');
