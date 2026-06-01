-- ============================================================
-- 041 — lead_intake_seen : index + fonction de purge périodique
-- ============================================================
-- Table de dédup pour le scraping (Multica, Google Places, etc.).
-- Pas de mécanisme de retention en place → grossit indéfiniment.
-- On ajoute un index sur seen_at + une fonction RPC purgeable
-- pour faciliter une rotation périodique (manuelle ou cron Vercel).
-- ============================================================

create index if not exists lead_intake_seen_seen_at_idx
  on public.lead_intake_seen(seen_at);

create or replace function public.purge_lead_intake_seen(
  older_than_days integer default 90
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.lead_intake_seen
  where seen_at < now() - (older_than_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.purge_lead_intake_seen is
  'Purge les entries lead_intake_seen plus anciennes que N jours (default 90). À exécuter trimestriellement : select purge_lead_intake_seen();';
