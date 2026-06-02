-- ============================================================
-- 042 — RLS hardening & function search_path
-- ============================================================
-- Suite à l'audit sécurité (Supabase advisors + scan pg_policies),
-- on durcit les zones identifiées comme trop permissives :
--
--  1. Policies `USING (true) WITH CHECK (true)` → on borne à
--     `auth.role() = 'authenticated'`. Le CRM ne sert que des
--     utilisateurs connectés, donc tout endpoint qui passe par
--     `supabase.from(...)` côté server (avec cookie session) reste
--     fonctionnel. Le client anon (preview public, scraping
--     externe non-authentifié) ne peut plus lire/écrire ces tables.
--
--  2. Fonctions avec `search_path` mutable → on fige à `public` pour
--     éviter les attaques par capture de schéma (un attaquant qui
--     créerait un schéma temporaire avec un `set_updated_at` malicieux).
--
--  3. Fonctions SECURITY DEFINER → on retire l'EXECUTE au rôle `anon`.
--     Les triggers continuent à fonctionner (ils s'exécutent avec
--     les droits du owner, pas du caller). Les RPC explicites
--     (`purge_lead_intake_seen`) ne sont accessibles qu'aux users
--     authentifiés ou service_role.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Policies trop permissives
-- ------------------------------------------------------------

-- email_campaigns : limiter aux users authentifiés
drop policy if exists "email_campaigns_select" on public.email_campaigns;
drop policy if exists "email_campaigns_insert" on public.email_campaigns;
drop policy if exists "email_campaigns_update" on public.email_campaigns;
drop policy if exists "email_campaigns_delete" on public.email_campaigns;
drop policy if exists "Allow all" on public.email_campaigns;

create policy "email_campaigns_authenticated_all"
  on public.email_campaigns
  for all
  to authenticated
  using (true)
  with check (true);

-- places_search_cache : cache partagé entre users authentifiés
drop policy if exists "places_search_cache_select" on public.places_search_cache;
drop policy if exists "places_search_cache_insert" on public.places_search_cache;
drop policy if exists "places_search_cache_update" on public.places_search_cache;
drop policy if exists "places_search_cache_delete" on public.places_search_cache;
drop policy if exists "Allow all" on public.places_search_cache;

create policy "places_search_cache_authenticated_all"
  on public.places_search_cache
  for all
  to authenticated
  using (true)
  with check (true);

-- places_search_log : log partagé entre users authentifiés
drop policy if exists "places_search_log_select" on public.places_search_log;
drop policy if exists "places_search_log_insert" on public.places_search_log;
drop policy if exists "places_search_log_update" on public.places_search_log;
drop policy if exists "places_search_log_delete" on public.places_search_log;
drop policy if exists "Allow all" on public.places_search_log;

create policy "places_search_log_authenticated_all"
  on public.places_search_log
  for all
  to authenticated
  using (true)
  with check (true);

-- prospection_settings : settings de prospection partagés
drop policy if exists "prospection_settings_select" on public.prospection_settings;
drop policy if exists "prospection_settings_insert" on public.prospection_settings;
drop policy if exists "prospection_settings_update" on public.prospection_settings;
drop policy if exists "prospection_settings_delete" on public.prospection_settings;
drop policy if exists "Allow all" on public.prospection_settings;

create policy "prospection_settings_authenticated_all"
  on public.prospection_settings
  for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- 2. search_path mutable → fixer à public
-- ------------------------------------------------------------
-- ALTER FUNCTION ... SET search_path = public garantit que les
-- références non-qualifiées (ex: `tasks` au lieu de `public.tasks`)
-- pointent toujours sur le bon schéma, même si la session caller
-- a manipulé search_path.

alter function public.set_updated_at() set search_path = public;
alter function public.generate_invoice_number() set search_path = public;
alter function public.lead_imports_track_stage_change() set search_path = public;
alter function public.clean_replacement_chars(text) set search_path = public;
alter function public.clean_encoding_trigger() set search_path = public;

-- ------------------------------------------------------------
-- 3. SECURITY DEFINER : retirer EXECUTE de `anon`
-- ------------------------------------------------------------
-- NB : `revoke` est idempotent ; les triggers continuent de
-- fonctionner (ils s'exécutent avec les privilèges du owner).
-- Seules les invocations directes (RPC `supabase.rpc(...)`) depuis
-- le rôle anon sont bloquées. Les users authentifiés et service_role
-- conservent leurs accès.

revoke execute on function public.create_default_project_tasks() from anon;
revoke execute on function public.create_project_for_won_deal() from anon;
revoke execute on function public.generate_invoice_number() from anon;
revoke execute on function public.purge_lead_intake_seen(integer) from anon;
revoke execute on function public.rls_auto_enable() from anon;

-- log_*_activity et notify_* : trigger functions, jamais appelées
-- directement par anon, mais on coupe par principe défense en
-- profondeur. On wrap dans un DO block pour ignorer si la fonction
-- n'existe pas (variations historiques de noms).
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

-- ------------------------------------------------------------
-- 4. Note opérationnelle : leaked password protection
-- ------------------------------------------------------------
-- Cette option doit être activée manuellement depuis le dashboard
-- Supabase : Auth → Settings → Password protection → enable.
-- Aucune migration SQL ne peut la flipper (config infra).
-- ============================================================
