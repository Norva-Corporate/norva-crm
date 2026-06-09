-- ============================================================
-- 047 — Rôles dynamiques + permissions granulaires
-- ============================================================
-- Refonte du RBAC : on passe d'un simple `profiles.role text` ('admin'|'member')
-- à un modèle (roles, role_permissions) gérable depuis l'UI.
--
-- Compatibilité :
--   - L'ancienne colonne `profiles.role` est CONSERVÉE pour rollback safety
--     (droppée dans une migration ultérieure une fois la transition validée).
--   - Les RLS existantes (qui lisent `profiles.role = 'admin'`) restent
--     fonctionnelles. Un trigger sync `role_id` ↔ `role` les garde alignés.
--   - Les helpers `is_admin()` et `has_permission()` sont prêts pour la
--     refonte progressive des policies (migration séparée).
-- ============================================================

-- ============================================================
-- 1. Table des rôles (système + custom)
-- ============================================================
create table if not exists public.roles (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,                       -- slug stable : 'admin', 'member', 'sales_manager'
  name text not null,                             -- libellé affiché
  description text,
  is_system boolean not null default false,       -- true = non-supprimable, non-renommable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roles enable row level security;

-- Lecture libre pour tous les authenticated (besoin de l'UI pour afficher
-- le rôle d'un collègue et alimenter le hook de permissions).
create policy "Authenticated can read roles" on public.roles
  for select using (auth.role() = 'authenticated');

-- Écritures réservées aux admins legacy (compatibilité Phase 1 :
-- on basculera vers has_permission('roles.manage') dans la migration de
-- refonte des RLS).
create policy "Admins can insert roles" on public.roles
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update roles" on public.roles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete roles" on public.roles
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_roles_updated_at
  before update on public.roles
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 2. Jointure rôle ↔ permission
-- ============================================================
-- Les permissions sont hardcodées côté code (src/lib/permissions/catalog.ts).
-- On stocke uniquement la clé en text — pas de FK vers une table de permissions
-- (évite de désynchroniser DB et code). Le ménage des clés obsolètes se fait
-- explicitement à la main si besoin.
create table if not exists public.role_permissions (
  role_id uuid references public.roles(id) on delete cascade,
  permission_key text not null,                   -- ex: 'companies.create'
  primary key (role_id, permission_key)
);

alter table public.role_permissions enable row level security;

-- Lecture libre : le hook usePermission a besoin de connaître les permissions
-- de son propre user, qu'on récupère via une jointure depuis le client.
create policy "Authenticated can read role_permissions" on public.role_permissions
  for select using (auth.role() = 'authenticated');

create policy "Admins can manage role_permissions" on public.role_permissions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 3. profiles.role_id (nouvelle colonne, ancienne colonne conservée)
-- ============================================================
alter table public.profiles
  add column if not exists role_id uuid references public.roles(id);

create index if not exists profiles_role_id_idx on public.profiles(role_id);

-- ============================================================
-- 4. Helpers SQL (security definer pour traverser les RLS de profiles)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.key = 'admin'
  )
  -- Fallback legacy : pendant la transition, certains profils peuvent ne pas
  -- encore avoir de role_id renseigné (race en signup). On retombe sur l'ancien
  -- champ.
  or exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_permission(perm_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid() and rp.permission_key = perm_key
  )
  -- Fallback legacy : un admin sans role_id (race) garde tous les droits.
  or public.is_admin();
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.has_permission(text) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

-- ============================================================
-- 5. Seed des deux rôles système
-- ============================================================
insert into public.roles (key, name, description, is_system)
values
  ('admin',  'Administrateur', 'Accès complet au CRM. Peut gérer les rôles et permissions.', true),
  ('member', 'Membre',         'Accès standard : consultation et création sur les modules principaux.', true)
on conflict (key) do nothing;

-- ============================================================
-- 6. Permissions de base (catalogue hardcodé — refléter catalog.ts)
-- ============================================================
-- ADMIN = TOUTES les permissions. On insère explicitement la liste plutôt
-- qu'un wildcard pour rester cohérent avec le check `has_permission(key)`.
do $$
declare
  admin_id uuid;
  member_id uuid;
  perm text;
  admin_perms text[] := array[
    -- companies
    'companies.read', 'companies.create', 'companies.update', 'companies.delete', 'companies.export', 'companies.assign',
    -- contacts
    'contacts.read', 'contacts.create', 'contacts.update', 'contacts.delete', 'contacts.export',
    -- deals
    'deals.read', 'deals.create', 'deals.update', 'deals.delete', 'deals.assign', 'deals.mark_won', 'deals.mark_lost', 'deals.export',
    -- projects
    'projects.read', 'projects.create', 'projects.update', 'projects.delete', 'projects.update_status',
    -- invoices
    'invoices.read', 'invoices.create', 'invoices.update', 'invoices.delete', 'invoices.update_status', 'invoices.export',
    -- tasks
    'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.update_status',
    -- leads
    'leads.read', 'leads.convert', 'leads.qualify', 'leads.dismiss', 'leads.batch',
    -- campaigns
    'campaigns.read', 'campaigns.create', 'campaigns.update', 'campaigns.validate_send', 'campaigns.reject',
    -- briefs
    'briefs.read', 'briefs.create', 'briefs.archive', 'briefs.convert_to_project',
    -- goals
    'goals.read', 'goals.create', 'goals.update', 'goals.archive', 'goals.delete',
    -- reporting
    'reporting.read',
    -- task_templates
    'task_templates.read', 'task_templates.create', 'task_templates.update', 'task_templates.delete', 'task_templates.apply',
    -- integrations
    'integrations.read', 'integrations.connect', 'integrations.disconnect',
    -- settings
    'settings.read', 'settings.update',
    -- users
    'users.read', 'users.invite', 'users.update_role', 'users.delete',
    -- roles (auto-gestion)
    'roles.read', 'roles.manage'
  ];
  member_perms text[] := array[
    -- lectures partout
    'companies.read', 'contacts.read', 'deals.read', 'projects.read', 'invoices.read',
    'tasks.read', 'leads.read', 'campaigns.read', 'briefs.read', 'goals.read',
    'reporting.read', 'task_templates.read', 'integrations.read', 'settings.read',
    'users.read', 'roles.read',
    -- écritures de base
    'companies.create', 'companies.update',
    'contacts.create', 'contacts.update',
    'deals.create', 'deals.update',
    'projects.create', 'projects.update', 'projects.update_status',
    'tasks.create', 'tasks.update', 'tasks.update_status',
    'briefs.create',
    'goals.create', 'goals.update',
    'task_templates.apply'
  ];
begin
  select id into admin_id from public.roles where key = 'admin';
  select id into member_id from public.roles where key = 'member';

  foreach perm in array admin_perms loop
    insert into public.role_permissions (role_id, permission_key)
    values (admin_id, perm)
    on conflict do nothing;
  end loop;

  foreach perm in array member_perms loop
    insert into public.role_permissions (role_id, permission_key)
    values (member_id, perm)
    on conflict do nothing;
  end loop;
end $$;

-- ============================================================
-- 7. Data migration : peupler profiles.role_id depuis l'ancien champ
-- ============================================================
update public.profiles
set role_id = (select id from public.roles where key = 'admin')
where role = 'admin' and role_id is null;

update public.profiles
set role_id = (select id from public.roles where key = 'member')
where role = 'member' and role_id is null;

-- ============================================================
-- 8. Trigger : maintenir l'ancien `role` text en sync avec `role_id`
-- ============================================================
-- Tant que les RLS existantes lisent `profiles.role`, on doit garder ce champ
-- aligné. Pour les rôles custom non-système, on stocke 'member' dans
-- l'ancienne colonne (granularité fine ignorée par les RLS legacy — c'est ok,
-- les permissions fines sont enforcement-côté Server Action).
create or replace function public.sync_profile_role_text()
returns trigger
language plpgsql
as $$
declare
  role_key text;
begin
  if new.role_id is null then
    return new;
  end if;

  select r.key into role_key from public.roles r where r.id = new.role_id;

  if role_key = 'admin' then
    new.role := 'admin';
  else
    new.role := 'member';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_profile_role_text_trg on public.profiles;
create trigger sync_profile_role_text_trg
  before insert or update of role_id on public.profiles
  for each row execute procedure public.sync_profile_role_text();

-- ============================================================
-- 9. handle_new_user : poser role_id en plus de role text
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  requested_role text;
  default_role_id uuid;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'member');
  if requested_role not in ('admin', 'member') then
    requested_role := 'member';
  end if;

  select id into default_role_id from public.roles where key = requested_role;

  insert into public.profiles (id, email, full_name, avatar_url, role, role_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    requested_role,
    default_role_id
  );
  return new;
end;
$$;
