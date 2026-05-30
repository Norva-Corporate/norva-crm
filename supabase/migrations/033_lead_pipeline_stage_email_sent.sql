-- ============================================================
-- 033 — Lead pipeline : ajoute le stage 'email_sent'
-- ============================================================
-- Nouvelle colonne kanban « Email envoyé » entre « À contacter » et
-- « Contacté ». Dropper un lead dedans = on lui a envoyé un cold
-- email. « Contacté » reste pour les autres canaux (appel, LinkedIn,
-- multi-touch, etc.).
--
-- Mise à jour purement additive : on relaxe le CHECK constraint, aucun
-- lead existant n'est impacté.
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
      'email_sent',
      'contacted',
      'in_discussion',
      'stand_by'
    )
  );

commit;
