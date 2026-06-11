-- ============================================================
-- 051 — Durcissement sécurité (revue de code globale)
-- ============================================================
-- Corrige, en s'appuyant sur les helpers SECURITY DEFINER de la 047
-- (is_admin(), has_permission(key)) :
--   1. Escalade de privilèges via profiles UPDATE (ni WITH CHECK ni garde
--      colonne → un membre pouvait s'auto-attribuer role/role_id admin).
--   2. INSERT non restreint sur notifications / lead_imports (spoof de
--      notifications / injection de faux leads par tout authentifié).
--   3. RLS goals : objectifs individuels éditables/supprimables par
--      n'importe quel membre (owner ignoré).
--   4. RLS task_templates : writes ouverts à tout authentifié.
--   5. Divergence RLS roles/role_permissions (inline role='admin' qui, après
--      la 048, exclut les rôles custom dotés de roles.manage).
--   6. Seed des nouvelles permissions tags.* / activities.* (cf. catalog.ts).
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles : empêcher l'auto-promotion (role / role_id)
-- ------------------------------------------------------------
-- Le client app utilise l'anon key + JWT (la RLS est la seule barrière sur
-- les writes PostgREST directs). On ajoute WITH CHECK + une garde colonne.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Les utilisateurs habilités (users.update_role → fallback is_admin) peuvent
-- mettre à jour n'importe quel profil. Remplace l'ancienne policy "admin"
-- inline pour rester cohérent avec assignUserRole côté Server Action.
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Privileged can update any profile" on public.profiles
  for update
  using (public.has_permission('users.update_role'))
  with check (public.has_permission('users.update_role'));

-- Garde colonne : role / role_id ne changent que si l'appelant possède
-- users.update_role. La RLS PostgreSQL ne filtre pas par colonne → trigger.
create or replace function public.guard_profile_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.role_id is distinct from old.role_id)
     and not public.has_permission('users.update_role') then
    raise exception 'Modification du role reservee aux utilisateurs habilites (users.update_role)';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile_privileged_cols() from public;

drop trigger if exists guard_profile_privileged_cols_trg on public.profiles;
create trigger guard_profile_privileged_cols_trg
  before update on public.profiles
  for each row execute procedure public.guard_profile_privileged_cols();

-- ------------------------------------------------------------
-- 2. notifications / lead_imports : INSERT réservé au service_role
-- ------------------------------------------------------------
-- Les triggers DB qui créent des notifications sont SECURITY DEFINER (ils
-- bypassent la RLS) ; les leads sont insérés par le webhook via service_role.
-- Restreindre l'INSERT à service_role n'impacte aucun flux légitime mais
-- bloque le spoof de notifications / l'injection de faux leads.
drop policy if exists "Service role can insert notifications" on public.notifications;
create policy "Service role can insert notifications" on public.notifications
  for insert to service_role with check (true);

drop policy if exists "Service role can insert lead_imports" on public.lead_imports;
create policy "Service role can insert lead_imports" on public.lead_imports
  for insert to service_role with check (true);

-- ------------------------------------------------------------
-- 3. goals : scoper les objectifs individuels à leur owner
-- ------------------------------------------------------------
drop policy if exists goals_auth_insert on public.goals;
create policy goals_auth_insert on public.goals
  for insert to authenticated
  with check (created_by = auth.uid() and public.has_permission('goals.create'));

drop policy if exists goals_auth_update on public.goals;
create policy goals_auth_update on public.goals
  for update to authenticated
  using (scope = 'team' or owner_profile_id = auth.uid() or public.is_admin())
  with check (scope = 'team' or owner_profile_id = auth.uid() or public.is_admin());

drop policy if exists goals_auth_delete on public.goals;
create policy goals_auth_delete on public.goals
  for delete to authenticated
  using (scope = 'team' or owner_profile_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- 4. task_templates : writes alignés sur les permissions
-- ------------------------------------------------------------
drop policy if exists task_templates_insert on public.task_templates;
create policy task_templates_insert on public.task_templates
  for insert to authenticated
  with check (public.has_permission('task_templates.create'));

drop policy if exists task_templates_update on public.task_templates;
create policy task_templates_update on public.task_templates
  for update to authenticated
  using (public.has_permission('task_templates.update'))
  with check (public.has_permission('task_templates.update'));

drop policy if exists task_templates_delete on public.task_templates;
create policy task_templates_delete on public.task_templates
  for delete to authenticated
  using (public.has_permission('task_templates.delete'));

-- ------------------------------------------------------------
-- 5. roles / role_permissions : aligner sur has_permission('roles.manage')
-- ------------------------------------------------------------
-- Avant : `exists(select 1 from profiles where id=auth.uid() and role='admin')`.
-- Après la 048, profiles.role ne vaut 'admin' que pour le rôle système : un
-- rôle custom doté de roles.manage passait assertPermission mais était bloqué
-- par la RLS. has_permission('roles.manage') retombe sur is_admin().
drop policy if exists "Admins can insert roles" on public.roles;
drop policy if exists "Admins can update roles" on public.roles;
drop policy if exists "Admins can delete roles" on public.roles;
create policy "Manage roles - insert" on public.roles
  for insert with check (public.has_permission('roles.manage'));
create policy "Manage roles - update" on public.roles
  for update using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));
create policy "Manage roles - delete" on public.roles
  for delete using (public.has_permission('roles.manage'));

drop policy if exists "Admins can manage role_permissions" on public.role_permissions;
create policy "Manage role_permissions" on public.role_permissions
  for all
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

-- ------------------------------------------------------------
-- 6. Seed des nouvelles permissions (tags / activities)
--    Doit rester aligné avec src/lib/permissions/catalog.ts
-- ------------------------------------------------------------
do $$
declare
  admin_id uuid;
  member_id uuid;
begin
  select id into admin_id from public.roles where key = 'admin';
  select id into member_id from public.roles where key = 'member';

  if admin_id is not null then
    insert into public.role_permissions (role_id, permission_key)
    values
      (admin_id, 'tags.manage'),
      (admin_id, 'activities.create'),
      (admin_id, 'activities.delete')
    on conflict do nothing;
  end if;

  if member_id is not null then
    insert into public.role_permissions (role_id, permission_key)
    values
      (member_id, 'tags.manage'),
      (member_id, 'activities.create')
    on conflict do nothing;
  end if;
end $$;
