-- ============================================================
-- 031 — Bascule Yousign → DocuSeal (renommage colonnes)
-- ============================================================
-- DocuSeal remplace Yousign comme fournisseur de signature
-- électronique. Mêmes garanties (eIDAS SES) mais free tier
-- utilisable en production (3 docs/mois cloud, illimité en
-- self-hosted) sans changer d'API si on bascule plus tard.
-- Les renames préservent les données ; aucune table n'est
-- supprimée.
-- ============================================================

alter table public.contrats
  rename column yousign_signature_request_id to docuseal_submission_id;
alter table public.contrats
  rename column yousign_signer_id to docuseal_submitter_id;

alter index if exists contrats_yousign_sr_idx rename to contrats_docuseal_submission_idx;

alter table public.contrat_events
  rename column yousign_event_id to docuseal_event_id;
