-- ============================================================
-- 007 — Tags + entity_tags polymorphic
-- ============================================================
create table public.tags (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#3B7BF5'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index tags_name_lower_unique on public.tags (lower(name));

alter table public.tags enable row level security;

create policy "Authenticated users can view tags" on public.tags
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert tags" on public.tags
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update tags" on public.tags
  for update using (auth.role() = 'authenticated');
create policy "Admins can delete tags" on public.tags
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create table public.entity_tags (
  tag_id uuid references public.tags(id) on delete cascade not null,
  entity_type text not null
    check (entity_type in ('contact', 'company', 'deal', 'project')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tag_id, entity_type, entity_id)
);

create index entity_tags_entity_idx
  on public.entity_tags(entity_type, entity_id);
create index entity_tags_tag_idx on public.entity_tags(tag_id);

alter table public.entity_tags enable row level security;

create policy "Authenticated users can view entity_tags" on public.entity_tags
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert entity_tags" on public.entity_tags
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can delete entity_tags" on public.entity_tags
  for delete using (auth.role() = 'authenticated');
