-- ============================================================
-- 014 — Champs personnalisés flexibles (custom fields)
-- ============================================================
-- Système polymorphique inspiré de 007_tags.sql.
-- Deux tables :
--   * custom_field_definitions : schéma (nom, type, options) au niveau workspace
--   * custom_field_values      : valeurs par entité (contact/company/deal/project)
-- Toutes les valeurs sont stockées en text. La conversion (number/date/bool)
-- se fait côté app.
-- ============================================================

create type public.custom_field_type as enum (
  'text',
  'number',
  'date',
  'select',
  'url',
  'boolean'
);

-- ── Définitions (niveau workspace) ──────────────────────────
create table public.custom_field_definitions (
  id           uuid primary key default uuid_generate_v4(),
  entity_type  text not null
                 check (entity_type in ('contact', 'company', 'deal', 'project')),
  name         text not null,
  field_type   public.custom_field_type not null default 'text',
  options      jsonb,
  required     boolean not null default false,
  sort_order   integer not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index custom_field_definitions_entity_idx
  on public.custom_field_definitions(entity_type, sort_order);

create unique index custom_field_definitions_name_entity_unique
  on public.custom_field_definitions(entity_type, lower(name));

alter table public.custom_field_definitions enable row level security;

create policy "Authenticated users can view field definitions"
  on public.custom_field_definitions for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can create field definitions"
  on public.custom_field_definitions for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update field definitions"
  on public.custom_field_definitions for update
  using (auth.role() = 'authenticated');

create policy "Admins can delete field definitions"
  on public.custom_field_definitions for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── Valeurs par entité ──────────────────────────────────────
create table public.custom_field_values (
  id           uuid primary key default uuid_generate_v4(),
  field_id     uuid not null
                 references public.custom_field_definitions(id) on delete cascade,
  entity_type  text not null
                 check (entity_type in ('contact', 'company', 'deal', 'project')),
  entity_id    uuid not null,
  value        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (field_id, entity_type, entity_id)
);

create index custom_field_values_entity_idx
  on public.custom_field_values(entity_type, entity_id);

create index custom_field_values_field_idx
  on public.custom_field_values(field_id);

alter table public.custom_field_values enable row level security;

create policy "Authenticated users can view field values"
  on public.custom_field_values for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert field values"
  on public.custom_field_values for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update field values"
  on public.custom_field_values for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete field values"
  on public.custom_field_values for delete
  using (auth.role() = 'authenticated');

-- ── Triggers updated_at ─────────────────────────────────────
-- `set_updated_at()` est créé par les migrations antérieures (001/006).
create trigger custom_field_definitions_updated_at
  before update on public.custom_field_definitions
  for each row execute procedure public.set_updated_at();

create trigger custom_field_values_updated_at
  before update on public.custom_field_values
  for each row execute procedure public.set_updated_at();
