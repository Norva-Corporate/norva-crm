-- ============================================================
-- 054 — Tracker d'appels (cold call) : table call_logs + RLS + permissions
-- ============================================================
-- Saisie de l'issue d'un appel directement dans le CRM → fin de la double saisie
-- Excel. Calqué trait pour trait sur 053_objection_logs_rls_permissions.sql.
--
--   reachability : joignabilité (toujours renseignée)
--                  'repondu' | 'messagerie' | 'pas_de_reponse' | 'numero_invalide'
--   result       : résultat de l'échange (uniquement si reachability='repondu')
--                  'rdv' | 'rappel' | 'devis' | 'pas_interesse'
--
-- Les scripts premier-contact (activities type='call', draft:true) ne sont PAS
-- touchés : table distincte → exclus des comptages par construction.
--
-- Frontière de sécurité réelle = assertPermission() côté Server Actions
-- (cf. src/lib/permissions/server.ts). Les RLS ci-dessous sont la ceinture.
-- ============================================================

-- ============================================================
-- 1. Table (idempotent) + index
-- ============================================================
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  called_at timestamptz not null default now(), -- date réelle de l'appel (éditable)
  reachability text not null,                    -- joignabilité (cf. lib/call-outcomes.ts)
  result text,                                   -- résultat si répondu (nullable)
  rep_id uuid references public.profiles(id),
  entity_type text,                              -- 'lead_import' | 'contact'
  entity_id uuid,                                -- id du lead/contact
  notes text
);

create index if not exists idx_call_logs_created on public.call_logs using btree (created_at desc);
create index if not exists idx_call_logs_called  on public.call_logs using btree (called_at desc);
create index if not exists idx_call_logs_rep     on public.call_logs using btree (rep_id);
-- Lookup par entité (historique sur la fiche lead/contact).
create index if not exists idx_call_logs_entity  on public.call_logs using btree (entity_type, entity_id);

-- ============================================================
-- 2. RLS
-- ============================================================
alter table public.call_logs enable row level security;

-- Lecture : tout utilisateur authentifié de l'agence.
drop policy if exists "Authenticated users can view call_logs" on public.call_logs;
create policy "Authenticated users can view call_logs" on public.call_logs
  for select using (auth.role() = 'authenticated');

-- Insertion : authentifié, en posant rep_id = soi-même (ou admin).
drop policy if exists "Authenticated users can insert call_logs" on public.call_logs;
create policy "Authenticated users can insert call_logs" on public.call_logs
  for insert with check (
    auth.role() = 'authenticated'
    and (rep_id = auth.uid() or public.is_admin())
  );

-- Suppression : l'auteur (sa propre saisie) ou un admin.
drop policy if exists "Author or admin can delete call_logs" on public.call_logs;
create policy "Author or admin can delete call_logs" on public.call_logs
  for delete using (rep_id = auth.uid() or public.is_admin());

-- ============================================================
-- 3. Seed des permissions `calls.*` (refléter catalog.ts)
-- ============================================================
-- admin  → read + create + delete
-- member → read + create
-- + tout rôle ayant déjà `leads.read` → read + create.
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
      (admin_id, 'calls.read'),
      (admin_id, 'calls.create'),
      (admin_id, 'calls.delete')
    on conflict do nothing;
  end if;

  if member_id is not null then
    insert into public.role_permissions (role_id, permission_key)
    values
      (member_id, 'calls.read'),
      (member_id, 'calls.create')
    on conflict do nothing;
  end if;
end $$;

-- Tout rôle qui peut déjà voir les leads peut logguer/consulter les appels.
insert into public.role_permissions (role_id, permission_key)
select rp.role_id, 'calls.read'
from public.role_permissions rp
where rp.permission_key = 'leads.read'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select rp.role_id, 'calls.create'
from public.role_permissions rp
where rp.permission_key = 'leads.read'
on conflict do nothing;
