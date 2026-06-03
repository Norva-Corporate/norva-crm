-- ============================================================
-- 042c — Verrouiller plus loin : retirer authenticated des triggers
-- ============================================================
-- Les fonctions trigger n'ont pas besoin d'être invocables via /rpc :
-- elles s'exécutent automatiquement quand les writes se produisent.
-- Le DB engine les invoque, l'EXECUTE permission ne bloque pas le trigger.
--
-- handle_new_user est un trigger sur auth.users sur signup, jamais
-- censé être appelé via RPC. On le verrouille complètement (seul
-- postgres l'invoque via le trigger).
-- ============================================================

-- 1. handle_new_user : retirer de anon, authenticated, public
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;
-- Note : pas de re-grant nécessaire, le trigger s'exécute sous le
-- owner (postgres) indépendamment des grants.

-- 2. create_default_project_tasks : appelée uniquement par un trigger
--    (projects_setup_tasks_trigger). Pas d'usage RPC légitime.
revoke execute on function public.create_default_project_tasks(uuid) from authenticated;

-- 3. log_*_activity / notify_* / projects_*_tasks_trigger : retirer
--    authenticated. Les triggers continuent de fonctionner.
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
    execute format('revoke execute on function public.%I(%s) from authenticated', fn_name, fn_signature);
  end loop;
end $$;
