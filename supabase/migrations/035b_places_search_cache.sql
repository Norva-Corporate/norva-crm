-- ============================================================
-- 035b — Cache + journal des appels Google Places (Lead Intake)
-- ============================================================
-- Note historique : appliquée en prod le 2026-06-01 hors-tracker
-- (cf. memory/migration-036-places-cache.md), avant la migration
-- 036_drop_discussion.sql qui suivait. Numérotée 035b pour préserver
-- l'ordre chronologique (035 → 035b → 036) sans collisionner avec
-- 036_drop_discussion déjà committée. Mêmes idempotences que les
-- autres : les tables et l'index existent déjà en prod, le `create
-- table` rejoue sans danger uniquement sur un environnement frais.
--
-- Réduit le coût Places API Text Search Enterprise en :
--   1. Cachant la réponse brute par signature de query (TTL 30j)
--   2. Journalisant chaque run (hit vs miss) → cap quotidien dur
--   3. Permettant la dedup place_id pré-enrichissement
-- Consommé par la skill docs/agents/skills/prospection-google-places.

begin;

create table public.places_search_cache (
  query_signature text not null,
  region_code text not null default 'FR',
  language_code text not null default 'fr',
  results jsonb not null,
  result_count int not null,
  cached_at timestamptz not null default now(),
  hit_count int not null default 0,
  primary key (query_signature, region_code, language_code)
);

create index places_search_cache_cached_at_idx
  on public.places_search_cache (cached_at desc);

alter table public.places_search_cache enable row level security;

create policy "Authenticated users can read places cache"
  on public.places_search_cache
  for select to authenticated using (true);

create policy "Service role manages places cache"
  on public.places_search_cache
  for all to service_role using (true) with check (true);

create table public.places_search_log (
  id uuid primary key default gen_random_uuid(),
  query_signature text not null,
  region_code text not null,
  cache_hit boolean not null,
  result_count int not null,
  new_place_ids int not null,
  run_at timestamptz not null default now()
);

create index places_search_log_run_at_idx
  on public.places_search_log (run_at desc);

create index places_search_log_daily_miss_idx
  on public.places_search_log (run_at)
  where cache_hit = false;

alter table public.places_search_log enable row level security;

create policy "Authenticated users can read places log"
  on public.places_search_log
  for select to authenticated using (true);

create policy "Service role manages places log"
  on public.places_search_log
  for all to service_role using (true) with check (true);

insert into public.prospection_settings (key, value)
values ('places_max_searches_per_day', '20')
on conflict (key) do nothing;

commit;
