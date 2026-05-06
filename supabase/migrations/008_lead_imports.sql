-- ============================================================
-- 008 — Lead imports (prospects entrants depuis sources externes)
-- ============================================================
create table public.lead_imports (
  id uuid primary key default uuid_generate_v4(),
  source text not null default 'multica',
  external_id text,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text,
  company_name text,
  company_domain text,
  status text not null default 'pending'
    check (status in ('pending', 'converted', 'dismissed', 'duplicate')),
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  duplicate_of uuid references public.contacts(id) on delete set null,
  raw_payload jsonb,
  imported_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null,
  notes text
);

create index lead_imports_status_idx on public.lead_imports(status, imported_at desc);
create index lead_imports_email_idx on public.lead_imports(lower(email)) where email is not null;
create unique index lead_imports_source_external_uniq
  on public.lead_imports(source, external_id) where external_id is not null;

alter table public.lead_imports enable row level security;

create policy "Authenticated users can view lead_imports" on public.lead_imports
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can update lead_imports" on public.lead_imports
  for update using (auth.role() = 'authenticated');
create policy "Service role can insert lead_imports" on public.lead_imports
  for insert with check (true);
create policy "Admins can delete lead_imports" on public.lead_imports
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
