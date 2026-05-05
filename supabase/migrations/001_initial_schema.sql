-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Admins can update any profile" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'member')
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- COMPANIES
-- ============================================================
create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  domain text,
  industry text,
  size text check (size in ('1-10', '11-50', '51-200', '201-500', '500+')),
  website text,
  phone text,
  address text,
  notes text,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "Authenticated users can view companies" on public.companies
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert companies" on public.companies
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);

create policy "Authenticated users can update companies" on public.companies
  for update using (auth.role() = 'authenticated');

create policy "Admins can delete companies" on public.companies
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_companies_updated_at
  before update on public.companies
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- CONTACTS
-- ============================================================
create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  job_title text,
  company_id uuid references public.companies(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "Authenticated users can view contacts" on public.contacts
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert contacts" on public.contacts
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);

create policy "Authenticated users can update contacts" on public.contacts
  for update using (auth.role() = 'authenticated');

create policy "Admins can delete contacts" on public.contacts
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- DEALS (Pipeline)
-- ============================================================
create table if not exists public.deals (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  value numeric(12,2),
  stage text not null default 'prospect'
    check (stage in ('prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  probability integer check (probability between 0 and 100),
  expected_close_date date,
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  stage_order integer not null default 0,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals enable row level security;

create policy "Authenticated users can view deals" on public.deals
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert deals" on public.deals
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);

create policy "Authenticated users can update deals" on public.deals
  for update using (auth.role() = 'authenticated');

create policy "Admins can delete deals" on public.deals
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_deals_updated_at
  before update on public.deals
  for each row execute procedure public.set_updated_at();

create index if not exists deals_stage_idx on public.deals(stage);
create index if not exists deals_assigned_to_idx on public.deals(assigned_to);

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  status text not null default 'planning'
    check (status in ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  deal_id uuid references public.deals(id) on delete set null,
  start_date date,
  end_date date,
  budget numeric(12,2),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Authenticated users can view projects" on public.projects
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert projects" on public.projects
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);

create policy "Authenticated users can update projects" on public.projects
  for update using (auth.role() = 'authenticated');

create policy "Admins can delete projects" on public.projects
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- INVOICES
-- ============================================================
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  number text not null unique,
  type text not null default 'invoice' check (type in ('quote', 'invoice')),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  project_id uuid references public.projects(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 20,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

create policy "Authenticated users can view invoices" on public.invoices
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert invoices" on public.invoices
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);

create policy "Authenticated users can update invoices" on public.invoices
  for update using (auth.role() = 'authenticated');

create policy "Admins can delete invoices" on public.invoices
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
create table if not exists public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

alter table public.invoice_items enable row level security;

create policy "Authenticated users can view invoice items" on public.invoice_items
  for select using (
    auth.role() = 'authenticated' and
    exists (select 1 from public.invoices where id = invoice_id)
  );

create policy "Authenticated users can manage invoice items" on public.invoice_items
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- INVOICE NUMBER SEQUENCE
-- ============================================================
create sequence if not exists invoice_number_seq start with 1;
create sequence if not exists quote_number_seq start with 1;

create or replace function public.generate_invoice_number(doc_type text)
returns text language plpgsql security definer
as $$
declare
  year_str text := to_char(now(), 'YYYY');
  seq_val bigint;
begin
  if doc_type = 'invoice' then
    seq_val := nextval('invoice_number_seq');
    return 'FAC-' || year_str || '-' || lpad(seq_val::text, 4, '0');
  else
    seq_val := nextval('quote_number_seq');
    return 'DEV-' || year_str || '-' || lpad(seq_val::text, 4, '0');
  end if;
end;
$$;
