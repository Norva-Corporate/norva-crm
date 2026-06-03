-- ============================================================
-- 037 — Drop Contrats module
-- ============================================================
-- Le module Contrats (signature électronique DocuSeal) est retiré.
-- Le suivi des contrats passe désormais par des fichiers Google
-- Sheets / Docs directement (intégration Google Drive prévue
-- en Phase C). On supprime les tables `contrats` et
-- `contrat_events` créées par 030_contrats_yousign.sql et
-- 031_contrats_docuseal_rename.sql.
--
-- Le bucket Storage `contrats` (si existant) doit être supprimé
-- manuellement depuis le dashboard Supabase, après dump si des
-- PDFs / dossiers de preuve sont encore présents.
-- ============================================================

-- Tables (ordre : enfants d'abord)
drop table if exists public.contrat_events;
drop table if exists public.contrats;

-- Les activités historiques avec entity_type='contrat' ou
-- type='contract_*' restent dans `activities` à des fins d'audit ;
-- le front les ignorera (entity_type retiré du type ActivityEntityType).
