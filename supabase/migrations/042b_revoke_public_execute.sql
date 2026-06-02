-- ============================================================
-- 042b — Revoke EXECUTE depuis PUBLIC + re-grant ciblé
-- ============================================================
-- Le revoke depuis `anon` (042) était neutralisé par le grant implicite
-- au pseudo-rôle PUBLIC, hérité à la création des fonctions. On révoque
-- PUBLIC puis on re-grant explicitement aux rôles légitimes
-- (authenticated, service_role).
--
-- Effet : anon ne peut plus invoquer ces RPC ; les writes authentifiés
-- continuent de déclencher les triggers normalement (l'EXECUTE permission
-- ne bloque pas l'invocation par le DB engine).
-- ============================================================

-- 1. RPC SECURITY DEFINER appelées par le code app (authenticated)
revoke execute on function public.create_default_project_tasks(uuid) from public;
grant  execute on function public.create_default_project_tasks(uuid) to authenticated, service_role;

revoke execute on function public.create_project_for_won_deal() from public;
grant  execute on function public.create_project_for_won_deal() to authenticated, service_role;

revoke execute on function public.generate_invoice_number(text) from public;
grant  execute on function public.generate_invoice_number(text) to authenticated, service_role;

-- 2. RPC reservées service_role (jamais appelées depuis le navigateur)
revoke execute on function public.purge_lead_intake_seen(integer) from public;
grant  execute on function public.purge_lead_intake_seen(integer) to service_role;

revoke execute on function public.rls_auto_enable() from public;
grant  execute on function public.rls_auto_enable() to service_role;

-- 3. Triggers : revoke PUBLIC + grant authenticated/service_role
--    (revoke authenticated viendra en 042c — les triggers fonctionnent
--    sans EXECUTE car invoqués par le DB engine, pas par les users)
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
    execute format('revoke execute on function public.%I(%s) from public', fn_name, fn_signature);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', fn_name, fn_signature);
  end loop;
end $$;
