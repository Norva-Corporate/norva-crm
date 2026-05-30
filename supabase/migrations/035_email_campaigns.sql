begin;

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead_imports(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Lead snapshot at generation time
  lead_snapshot jsonb not null default '{}',

  -- Three generated email variants
  variant_1 jsonb not null default '{}',
  variant_2 jsonb not null default '{}',
  variant_3 jsonb not null default '{}',

  -- Selected & possibly edited variant (null = not yet validated)
  selected_variant jsonb default null,

  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'rejected')),

  sent_at timestamptz default null,
  sent_by uuid references public.profiles(id) on delete set null
);

alter table public.email_campaigns enable row level security;

create policy "Authenticated users can manage campaigns"
  on public.email_campaigns
  for all
  to authenticated
  using (true)
  with check (true);

-- Settings table for prospection config
create table if not exists public.prospection_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.prospection_settings enable row level security;

create policy "Authenticated users can manage settings"
  on public.prospection_settings
  for all
  to authenticated
  using (true)
  with check (true);

-- Default settings
insert into public.prospection_settings (key, value) values
  ('send_hour', '09'),
  ('max_per_day', '10'),
  ('gmail_refresh_token', '')
on conflict (key) do nothing;

-- Auto-update updated_at
create trigger set_email_campaigns_updated_at
  before update on public.email_campaigns
  for each row execute function public.set_updated_at();

create trigger set_prospection_settings_updated_at
  before update on public.prospection_settings
  for each row execute function public.set_updated_at();

commit;
