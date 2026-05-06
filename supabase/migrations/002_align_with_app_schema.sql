-- ============================================================
-- Aligne la base live avec ce qu'attend le code applicatif :
--   companies : domain, size, notes, created_by, updated_at
--   contacts  : notes, created_by, updated_at
--
-- Idempotent : add column IF NOT EXISTS, ré-exécutable sans erreur.
-- ============================================================

-- ------------------------------------------------------------
-- COMPANIES
-- ------------------------------------------------------------
alter table public.companies
  add column if not exists domain     text,
  add column if not exists size       text,
  add column if not exists notes      text,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz not null default now();

-- Contrainte de check pour size (nullable mais valeurs limitées)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_size_check'
  ) then
    alter table public.companies
      add constraint companies_size_check
      check (size is null or size in ('1-10', '11-50', '51-200', '201-500', '500+'));
  end if;
end $$;

-- FK created_by -> profiles(id) si la table profiles existe
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) and not exists (
    select 1 from pg_constraint
    where conname = 'companies_created_by_fkey'
  ) then
    alter table public.companies
      add constraint companies_created_by_fkey
      foreign key (created_by) references public.profiles(id);
  end if;
end $$;

-- ------------------------------------------------------------
-- CONTACTS
-- ------------------------------------------------------------
alter table public.contacts
  add column if not exists notes      text,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) and not exists (
    select 1 from pg_constraint
    where conname = 'contacts_created_by_fkey'
  ) then
    alter table public.contacts
      add constraint contacts_created_by_fkey
      foreign key (created_by) references public.profiles(id);
  end if;
end $$;

-- ------------------------------------------------------------
-- TRIGGER updated_at — on (re)crée la fonction si besoin et on attache
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
  before update on public.companies
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();
