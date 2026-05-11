-- ============================================================
-- 020 — Stage tracking + tasks liées aux leads
-- ============================================================
-- 1) `stage_updated_at` sur lead_imports + trigger qui le met à jour
--    quand pipeline_stage change → permet de détecter les leads
--    stagnants (badge ⏰ jaune/rouge).
-- 2) `tasks.related_type` accepte `lead_import` → pour les tâches
--    auto créées par les drag du kanban.
-- 3) `tasks.auto_origin` text nullable → marqueur pour les tâches
--    auto-créées par un changement de stage (permet dédup propre).
-- ============================================================

-- 1. Stage tracking sur lead_imports
alter table public.lead_imports
  add column if not exists stage_updated_at timestamptz not null default now();

create or replace function public.lead_imports_track_stage_change()
returns trigger language plpgsql as $$
begin
  if new.pipeline_stage is distinct from old.pipeline_stage then
    new.stage_updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists lead_imports_stage_tracker on public.lead_imports;
create trigger lead_imports_stage_tracker
  before update on public.lead_imports
  for each row execute procedure public.lead_imports_track_stage_change();

-- 2. tasks.related_type accepte lead_import
alter table public.tasks
  drop constraint if exists tasks_related_type_check,
  add constraint tasks_related_type_check
    check (related_type in ('contact', 'company', 'deal', 'project', 'lead_import'));

-- 3. tasks.auto_origin (marqueur pour dédup)
alter table public.tasks
  add column if not exists auto_origin text;

create index if not exists tasks_auto_origin_idx
  on public.tasks(auto_origin, related_id)
  where auto_origin is not null and status = 'pending';
