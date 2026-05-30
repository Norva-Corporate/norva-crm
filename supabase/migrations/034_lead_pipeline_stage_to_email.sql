-- ============================================================
-- 034 — Lead pipeline : renomme 'email_sent' → 'to_email'
-- ============================================================
-- Re-sémantique : la colonne « Email envoyé » (action terminée)
-- devient « À mailer » (TODO), parallèle aux colonnes « À contacter »
-- splittées par owner. Dropper un lead dedans = c'est un cold email
-- à envoyer cette semaine.
--
-- Aucun lead n'utilisait 'email_sent' (stage déployé quelques minutes
-- plus tôt sans usage). Migration purement structurelle.
-- ============================================================

begin;

-- Pas de UPDATE nécessaire (0 row avant la bascule), mais safe au cas où :
update public.lead_imports
  set pipeline_stage = 'to_email'
  where pipeline_stage = 'email_sent';

alter table public.lead_imports
  drop constraint if exists lead_imports_pipeline_stage_check;

alter table public.lead_imports
  add constraint lead_imports_pipeline_stage_check
  check (
    pipeline_stage in (
      'brut',
      'verified',
      'to_contact',
      'to_email',
      'contacted',
      'in_discussion',
      'stand_by'
    )
  );

commit;
