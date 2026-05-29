-- ============================================================
-- 030 — Contrats + Yousign (signature électronique eIDAS SES)
-- ============================================================
-- Permet, depuis une fiche deal/contact, de générer un PDF de
-- contrat de prestation, l'envoyer à signer via Yousign API v3,
-- suivre le statut, et récupérer automatiquement à la signature
-- le PDF signé + le dossier de preuve dans Supabase Storage.
--
-- Conventions :
--   - PDF non exposé en signed URL : route auth-gated
--     (même pattern que /api/briefs/[id]/pdf).
--   - Webhook public sécurisé par HMAC-SHA256 sur raw body
--     + idempotence via contrat_events.yousign_event_id UNIQUE.
--   - client_snapshot figé à l'envoi (raison sociale, SIRET,
--     email, téléphone, représentant) — couverture juridique.
-- ============================================================

-- ── Étendre activities.entity_type pour accepter 'contrat' ──
-- Le constraint en base inclut 'lead_import' (ajouté hors séquence
-- de migrations versionnées) → on le préserve.
alter table public.activities
  drop constraint if exists activities_entity_type_check;
alter table public.activities
  add constraint activities_entity_type_check
  check (entity_type in ('contact', 'company', 'deal', 'project', 'invoice', 'lead_import', 'contrat'));

-- ── CONTRATS ────────────────────────────────────────────────
create table public.contrats (
  id                              uuid primary key default uuid_generate_v4(),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  deal_id                         uuid references public.deals(id) on delete set null,
  contact_id                      uuid references public.contacts(id) on delete set null,
  ref                             text not null,
  client_snapshot                 jsonb not null,
  options                         jsonb not null,
  montant_total                   numeric(12, 2) not null,
  acompte                         numeric(12, 2) not null,
  solde                           numeric(12, 2) not null,
  statut                          text not null default 'brouillon'
    check (statut in ('brouillon', 'genere', 'envoye', 'signe', 'refuse', 'expire')),
  yousign_signature_request_id    text,
  yousign_signer_id               text,
  pdf_path                        text,
  signed_pdf_path                 text,
  proof_path                      text,
  sent_at                         timestamptz,
  signed_at                       timestamptz,
  expires_at                      timestamptz,
  created_by                      uuid references public.profiles(id) not null
);

create unique index contrats_ref_idx on public.contrats(ref);
create index contrats_deal_idx on public.contrats(deal_id, created_at desc);
create index contrats_contact_idx on public.contrats(contact_id, created_at desc);
create index contrats_statut_idx on public.contrats(statut, created_at desc);
create unique index contrats_yousign_sr_idx
  on public.contrats(yousign_signature_request_id)
  where yousign_signature_request_id is not null;

alter table public.contrats enable row level security;

create policy "Authenticated users can view contrats" on public.contrats
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert contrats" on public.contrats
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);

create policy "Authenticated users can update contrats" on public.contrats
  for update using (auth.role() = 'authenticated');

create policy "Admins can delete contrats" on public.contrats
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_contrats_updated_at
  before update on public.contrats
  for each row execute procedure public.set_updated_at();

-- ── CONTRAT_EVENTS (journal + idempotence webhook) ──────────
create table public.contrat_events (
  id                  uuid primary key default uuid_generate_v4(),
  contrat_id          uuid references public.contrats(id) on delete cascade not null,
  yousign_event_id    text not null unique,
  event_name          text not null,
  payload             jsonb not null,
  received_at         timestamptz not null default now()
);

create index contrat_events_contrat_idx
  on public.contrat_events(contrat_id, received_at desc);

alter table public.contrat_events enable row level security;

create policy "Authenticated users can view contrat_events" on public.contrat_events
  for select using (auth.role() = 'authenticated');
-- Pas de policy INSERT/UPDATE/DELETE : seul le service role écrit
-- (webhook /api/webhooks/yousign).

-- ── REALTIME — expose contrats ──────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'contrats'
  ) then
    alter publication supabase_realtime add table public.contrats;
  end if;
end $$;

-- ── STORAGE — bucket privé pour PDF / PDF signé / preuve ────
-- Accès via service_role uniquement, streamé par routes auth-gated.
insert into storage.buckets (id, name, public)
values ('contrats', 'contrats', false)
on conflict (id) do nothing;
