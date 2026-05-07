-- ============================================================
-- 011 — User integrations (per-user OAuth tokens) + CRM↔external event mapping
-- Adds support for 1-way export of CRM events (deals/tasks/projects/invoices)
-- to each user's Google Calendar via OAuth 2.0.
-- ============================================================

-- ============================================================
-- USER_INTEGRATIONS
-- One row per (user_id, provider). Tokens are stored encrypted at the
-- application layer (AES-256-GCM via INTEGRATIONS_ENC_KEY) — Supabase RLS
-- alone does not protect against a leaked service_role key or a DB dump.
-- ============================================================
create table if not exists public.user_integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scope text not null,
  google_calendar_id text,
  google_account_email text,
  last_sync_at timestamptz,
  last_sync_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists user_integrations_user_idx
  on public.user_integrations(user_id, provider);

alter table public.user_integrations enable row level security;

-- A user sees only their own integration row
create policy "user_integrations_select_own" on public.user_integrations
  for select using (auth.uid() = user_id);

-- A user can update their own row (e.g. last_sync_error display)
create policy "user_integrations_update_own" on public.user_integrations
  for update using (auth.uid() = user_id);

-- A user can disconnect (delete) their own integration
create policy "user_integrations_delete_own" on public.user_integrations
  for delete using (auth.uid() = user_id);

-- INSERT is intentionally NOT permitted to anon/authenticated roles —
-- the OAuth callback route uses the service role to bootstrap the row.

create trigger set_user_integrations_updated_at
  before update on public.user_integrations
  for each row execute procedure public.set_updated_at();


-- ============================================================
-- CALENDAR_EVENT_LINKS
-- Maps a CRM source row (deal / project / task / invoice) to a Google
-- Calendar event id, scoped per user (each connected user has their own
-- google_event_id for the same CRM entity).
-- A project produces 2 events (start + end), encoded via source_kind.
-- ============================================================
create table if not exists public.calendar_event_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_kind text not null check (source_kind in
    ('deal','project_start','project_end','task','invoice')),
  source_id uuid not null,
  google_event_id text not null,
  google_calendar_id text not null,
  last_synced_at timestamptz not null default now(),
  unique (user_id, source_kind, source_id)
);

create index if not exists cel_lookup_idx
  on public.calendar_event_links(user_id, source_kind, source_id);

create index if not exists cel_user_idx
  on public.calendar_event_links(user_id);

alter table public.calendar_event_links enable row level security;

-- A user can read their own mapping rows (debug / introspection)
create policy "calendar_event_links_select_own" on public.calendar_event_links
  for select using (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE are performed exclusively by the sync engine
-- via the service-role client. No policy = default deny for client roles.
