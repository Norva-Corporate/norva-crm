-- ============================================================
-- 029 — Pipeline : retirer 'prospect' + 'qualified', démarrer à 'discussion'
-- ============================================================
-- Les colonnes Prospect et Qualifié du Pipeline (deals.stage) font
-- doublon avec les stages Leads (`to_contact` / `contacted` /
-- `in_discussion`). Quand un lead est converti en deal via
-- convertLeadToDeal, la discussion est déjà engagée — il n'y a
-- plus lieu de repasser par "Prospect" puis "Qualifié".
--
-- Nouveau pipeline : discussion → proposal → negotiation → won/lost.
--
-- Migration atomique :
--   1. Backfill les deals legacy (prospect, qualified) vers discussion.
--   2. Remplacer le check constraint et le default.
--
-- L'index `deals_stage_idx` (full, non partiel) reste valide.
-- Les payloads d'activités historiques `deal_stage_changed`
-- contenant `from:'prospect'` / `to:'qualified'` ne sont PAS modifiés
-- (l'historique reste source de vérité ; le rendu front fallback
-- gracieusement sur la clé brute).
-- ============================================================

begin;

update public.deals
set stage = 'discussion'
where stage in ('prospect', 'qualified');

alter table public.deals
  drop constraint if exists deals_stage_check;

alter table public.deals
  alter column stage set default 'discussion';

alter table public.deals
  add constraint deals_stage_check
  check (stage in ('discussion', 'proposal', 'negotiation', 'won', 'lost'));

commit;
