-- ============================================================
-- 025 — Brief Tokens & Briefs
-- ============================================================
-- Système de brief client à accès restreint par token unique.
-- Flux :
--   1. CRM génère un token via POST /api/briefs/generate-token
--   2. Lien envoyé au prospect : https://norva-corporate.fr/brief?token=xxx
--   3. Vitrine vérifie via GET /api/briefs/verify-token
--   4. Prospect soumet via POST /api/briefs/submit
--      → token consommé (used=true) + ligne dans briefs
-- ============================================================

create table public.brief_tokens (
  id                   uuid primary key default uuid_generate_v4(),
  token                text unique not null,
  prospect_nom         text not null,
  prospect_email       text not null,
  prospect_entreprise  text,
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null,
  used                 boolean not null default false,
  used_at              timestamptz,
  created_by           uuid references public.profiles(id) on delete set null
);

create index brief_tokens_token_idx on public.brief_tokens(token);
create index brief_tokens_active_idx
  on public.brief_tokens(expires_at)
  where used = false;
create index brief_tokens_created_idx on public.brief_tokens(created_at desc);

create table public.briefs (
  id                   uuid primary key default uuid_generate_v4(),
  token_id             uuid references public.brief_tokens(id) on delete set null,
  prospect_nom         text,
  prospect_email       text,
  prospect_entreprise  text,
  reponses             jsonb not null,
  submitted_at         timestamptz not null default now()
  -- pdf_url text  <-- ajouté en Phase 2
);

create index briefs_submitted_idx on public.briefs(submitted_at desc);
create index briefs_token_idx on public.briefs(token_id);

-- ── RLS ─────────────────────────────────────────────────────
-- Lecture seule pour les utilisateurs authentifiés (UI CRM).
-- Toutes les écritures passent par service_role dans les API routes :
--   - generate-token (vérifie session côté serveur)
--   - submit (publique, CORS depuis la vitrine)
-- Aucune policy insert/update/delete : la RLS bloque l'anon key.

alter table public.brief_tokens enable row level security;
alter table public.briefs enable row level security;

create policy "Authenticated users can view brief_tokens"
  on public.brief_tokens for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can view briefs"
  on public.briefs for select
  using (auth.role() = 'authenticated');
