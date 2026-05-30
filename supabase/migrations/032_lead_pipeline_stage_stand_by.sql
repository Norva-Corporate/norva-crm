-- ============================================================
-- 032 — Lead pipeline : ajoute le stage 'stand_by'
-- ============================================================
-- Nouvelle colonne kanban pour parker les leads qu'on devra rappeler
-- plus tard (1+ mois). Sert de destination terminale-mais-réversible :
-- on a déjà échangé avec eux, ils ne sont pas mûrs aujourd'hui.
--
-- Mise à jour purement additive : on relaxe le CHECK constraint pour
-- accepter la nouvelle valeur, aucun lead existant n'est impacté.
-- ============================================================

begin;

alter table public.lead_imports
  drop constraint if exists lead_imports_pipeline_stage_check;

alter table public.lead_imports
  add constraint lead_imports_pipeline_stage_check
  check (
    pipeline_stage in (
      'brut',
      'verified',
      'to_contact',
      'contacted',
      'in_discussion',
      'stand_by'
    )
  );

commit;
