-- ============================================================
-- 042 — RLS hardening : search_path + revoke anon (passe 1)
-- ============================================================
-- Suite à l'audit sécurité (Supabase advisors), on durcit deux zones :
--
--  1. Fonctions avec `search_path` mutable → on fige à `public` pour
--     éviter les attaques par capture de schéma (un attaquant qui
--     créerait un schéma temporaire avec un `set_updated_at` malicieux).
--
--  2. Fonctions SECURITY DEFINER → on retire l'EXECUTE au rôle `anon`.
--     Les triggers continuent à fonctionner (ils s'exécutent avec les
--     droits du owner, pas du caller). Voir 042b pour le revoke
--     complémentaire depuis PUBLIC (sinon le grant implicite à PUBLIC
--     annule le revoke ciblé sur anon).
--
-- Note : les 4 policies USING (true) flaggées par l'advisor
-- (email_campaigns, places_search_cache, places_search_log,
-- prospection_settings) sont en fait correctement scopées sur les
-- rôles authenticated / service_role — c'est un design choice
-- intentionnel (cache + settings partagés entre membres de l'équipe).
-- On ne les touche pas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. search_path mutable → fixer à public
-- ------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;
alter function public.generate_invoice_number(text) set search_path = public;
alter function public.lead_imports_track_stage_change() set search_path = public;
alter function public.clean_replacement_chars(text) set search_path = public;
alter function public.clean_encoding_trigger() set search_path = public;

-- ------------------------------------------------------------
-- 2. SECURITY DEFINER : revoke EXECUTE depuis anon
-- ------------------------------------------------------------
-- NB : ce revoke seul est insuffisant — PUBLIC (rôle parent) garde
-- EXECUTE par défaut à la création de la fonction. Voir 042b qui
-- révoque PUBLIC + re-grant ciblé.
revoke execute on function public.create_default_project_tasks(uuid) from anon;
revoke execute on function public.create_project_for_won_deal() from anon;
revoke execute on function public.generate_invoice_number(text) from anon;
revoke execute on function public.purge_lead_intake_seen(integer) from anon;
revoke execute on function public.rls_auto_enable() from anon;

-- log_*_activity / notify_* / projects_*_tasks_trigger : trigger
-- functions, jamais appelées directement par anon, mais on coupe par
-- principe défense en profondeur.
do $$
declare
  fn_name text;
  fn_signature text;
begin
  for fn_name, fn_signature in
    select p.proname, pg_get_function_identity_arguments(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and (
        p.proname like 'log_%_activity'
        or p.proname like 'notify_%'
        or p.proname like 'projects_%_tasks_trigger'
      )
  loop
    execute format(
      'revoke execute on function public.%I(%s) from anon',
      fn_name,
      fn_signature
    );
  end loop;
end $$;
