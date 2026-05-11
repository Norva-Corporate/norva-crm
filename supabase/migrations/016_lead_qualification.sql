-- ============================================================
-- 016 — Lead qualification : enrichir les leads avant conversion
-- ============================================================
-- 1) Ouvre les 3 systèmes polymorphes (activities, entity_tags, custom_fields)
--    au type 'lead_import' pour pouvoir attacher notes/timeline, tags et
--    custom fields à un lead.
-- 2) Ajoute un statut intermédiaire 'qualified' à lead_imports.
-- 3) Ajoute des champs de qualification structurés (assigned_to, temperature,
--    qualification_score, next_follow_up_at, estimated_budget,
--    expected_close_date).
-- ============================================================

-- ── 1a. activities.entity_type ──────────────────────────────
alter table public.activities
  drop constraint if exists activities_entity_type_check,
  add constraint activities_entity_type_check
    check (entity_type in ('contact', 'company', 'deal', 'project', 'invoice', 'lead_import'));

-- ── 1b. entity_tags.entity_type ─────────────────────────────
alter table public.entity_tags
  drop constraint if exists entity_tags_entity_type_check,
  add constraint entity_tags_entity_type_check
    check (entity_type in ('contact', 'company', 'deal', 'project', 'lead_import'));

-- ── 1c. custom_field_definitions.entity_type ────────────────
alter table public.custom_field_definitions
  drop constraint if exists custom_field_definitions_entity_type_check,
  add constraint custom_field_definitions_entity_type_check
    check (entity_type in ('contact', 'company', 'deal', 'project', 'lead_import'));

-- ── 1d. custom_field_values.entity_type ─────────────────────
alter table public.custom_field_values
  drop constraint if exists custom_field_values_entity_type_check,
  add constraint custom_field_values_entity_type_check
    check (entity_type in ('contact', 'company', 'deal', 'project', 'lead_import'));

-- ── 2. lead_imports.status — ajouter 'qualified' ────────────
alter table public.lead_imports
  drop constraint if exists lead_imports_status_check,
  add constraint lead_imports_status_check
    check (status in ('pending', 'qualified', 'converted', 'dismissed', 'duplicate'));

-- ── 3. lead_imports — champs de qualification ───────────────
alter table public.lead_imports
  add column if not exists assigned_to uuid
    references public.profiles(id) on delete set null,
  add column if not exists temperature text
    check (temperature in ('cold', 'warm', 'hot')),
  add column if not exists qualification_score smallint
    check (qualification_score between 1 and 5),
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists estimated_budget numeric(12, 2),
  add column if not exists expected_close_date date;

create index if not exists lead_imports_assigned_idx
  on public.lead_imports(assigned_to)
  where assigned_to is not null;

create index if not exists lead_imports_follow_up_idx
  on public.lead_imports(next_follow_up_at)
  where next_follow_up_at is not null;
