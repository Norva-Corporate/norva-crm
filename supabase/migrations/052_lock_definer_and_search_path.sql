-- ============================================================
-- 052 — Verrous complémentaires (advisor sécurité post-051)
-- ============================================================
-- 1. guard_profile_privileged_cols (créée en 051) est une trigger function :
--    jamais censée être appelée via /rpc. La 051 ne révoquait que `public`,
--    mais les default privileges Supabase la ré-exposent à anon/authenticated.
--    On l'aligne sur le pattern 042c (le trigger s'exécute sous l'owner,
--    indépendamment des grants → aucune incidence fonctionnelle).
-- 2. Fige le search_path des trigger functions restantes (cohérence 042).
-- ============================================================

revoke execute on function public.guard_profile_privileged_cols() from anon, authenticated;

alter function public.sync_profile_role_text() set search_path = public;
alter function public.clean_encoding_trigger() set search_path = public;
