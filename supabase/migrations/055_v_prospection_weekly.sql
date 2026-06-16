-- ============================================================
-- 055 — Vue agrégée prospection : volume + issues par commercial & par semaine
-- ============================================================
-- Livrable « perf prospection par commercial / par semaine ». Source = call_logs.
-- Semaine = lundi (date_trunc('week', …) en Postgres). `rep_id` = commercial.
--
-- Les conversions « devis envoyés » / « signés » (deals stage proposal/won)
-- sont jointes côté dashboard (les deals portent leur propre horodatage et
-- attribution `assigned_to`, et la table est quasi vide aujourd'hui). La vue
-- reste extensible à ces colonnes plus tard.
--
-- security_invoker = on → la vue s'exécute avec les droits de l'appelant et
-- respecte donc la RLS de call_logs (évite aussi l'alerte « security definer
-- view » de l'advisor Supabase).
-- ============================================================
create or replace view public.v_prospection_weekly
with (security_invoker = on) as
select
  date_trunc('week', cl.called_at)::date as week,
  cl.rep_id,
  count(*)                                            as appels_passes,
  count(*) filter (where cl.reachability = 'repondu') as repondus,
  count(*) filter (
    where cl.reachability in ('messagerie', 'pas_de_reponse', 'numero_invalide')
  )                                                   as sans_reponse,
  count(*) filter (where cl.result = 'rdv')           as rdv_obtenus,
  count(*) filter (where cl.result = 'rappel')        as a_rappeler,
  count(*) filter (where cl.result = 'devis')         as devis_a_envoyer
from public.call_logs cl
group by 1, 2;
