-- ============================================================
-- 053 — Tracker d'objections : RLS + permissions sur objection_logs
-- ============================================================
-- La table public.objection_logs a été créée hors migration (console / MCP).
-- RLS y était activé mais SANS aucune policy → toutes les requêtes échouaient
-- (deny par défaut). Cette migration :
--   1. (re)déclare la table de façon idempotente (no-op si déjà présente,
--      correct pour un environnement neuf).
--   2. ajoute les policies RLS (modèle calqué sur `activities` + ownership).
--   3. seede les permissions `objections.*` par rôle (refléter catalog.ts).
--
-- Frontière de sécurité réelle = assertPermission() côté Server Actions
-- (cf. src/lib/permissions/server.ts). Les RLS ci-dessous sont la ceinture.
-- ============================================================

-- ============================================================
-- 1. Table (idempotent) + index
-- ============================================================
create table if not exists public.objection_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  objection_id text not null,        -- une des 21 clés du catalogue (lib/objections.ts)
  objection_label text,              -- auto-rempli depuis le catalogue
  stage text not null,               -- 'coldcall' | 'audit' | 'annexes'
  outcome text,                      -- 'accepte' | 'hesite' | 'refuse'
  pain_id text,                      -- ex 'no_website' (nullable)
  rep_id uuid references public.profiles(id),
  entity_type text,                  -- 'lead_import' | 'contact'
  entity_id uuid,                    -- id du lead/contact
  notes text
);

create index if not exists idx_objection_logs_created   on public.objection_logs using btree (created_at desc);
create index if not exists idx_objection_logs_objection on public.objection_logs using btree (objection_id);
create index if not exists idx_objection_logs_rep       on public.objection_logs using btree (rep_id);
-- Lookup par entité (historique sur la fiche lead/contact).
create index if not exists idx_objection_logs_entity    on public.objection_logs using btree (entity_type, entity_id);

-- ============================================================
-- 2. RLS
-- ============================================================
alter table public.objection_logs enable row level security;

-- Lecture : tout utilisateur authentifié de l'agence.
drop policy if exists "Authenticated users can view objection_logs" on public.objection_logs;
create policy "Authenticated users can view objection_logs" on public.objection_logs
  for select using (auth.role() = 'authenticated');

-- Insertion : authentifié, en posant rep_id = soi-même (ou admin).
drop policy if exists "Authenticated users can insert objection_logs" on public.objection_logs;
create policy "Authenticated users can insert objection_logs" on public.objection_logs
  for insert with check (
    auth.role() = 'authenticated'
    and (rep_id = auth.uid() or public.is_admin())
  );

-- Suppression : l'auteur (sa propre saisie) ou un admin.
drop policy if exists "Author or admin can delete objection_logs" on public.objection_logs;
create policy "Author or admin can delete objection_logs" on public.objection_logs
  for delete using (rep_id = auth.uid() or public.is_admin());

-- ============================================================
-- 3. Seed des permissions `objections.*` (refléter catalog.ts)
-- ============================================================
-- admin  → read + create + delete
-- member → read + create
-- + tout rôle ayant déjà `leads.read` (couvre 'laurent' et futurs rôles
--   custom de prospection) → read + create.
do $$
declare
  admin_id uuid;
  member_id uuid;
begin
  select id into admin_id  from public.roles where key = 'admin';
  select id into member_id from public.roles where key = 'member';

  if admin_id is not null then
    insert into public.role_permissions (role_id, permission_key)
    values
      (admin_id, 'objections.read'),
      (admin_id, 'objections.create'),
      (admin_id, 'objections.delete')
    on conflict do nothing;
  end if;

  if member_id is not null then
    insert into public.role_permissions (role_id, permission_key)
    values
      (member_id, 'objections.read'),
      (member_id, 'objections.create')
    on conflict do nothing;
  end if;
end $$;

-- Tout rôle qui peut déjà voir les leads peut logguer/consulter les objections.
insert into public.role_permissions (role_id, permission_key)
select rp.role_id, 'objections.read'
from public.role_permissions rp
where rp.permission_key = 'leads.read'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select rp.role_id, 'objections.create'
from public.role_permissions rp
where rp.permission_key = 'leads.read'
on conflict do nothing;
