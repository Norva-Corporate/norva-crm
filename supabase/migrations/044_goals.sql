-- ============================================================
-- 044 — goals
-- ============================================================
-- Objectifs CRM avec suivi de progression automatique.
--
-- scope :
--   - 'team'        : objectif d'équipe, owner_profile_id NULL
--   - 'individual'  : objectif perso, owner_profile_id = profile.id
--
-- metric_type (figés pour la v1, extensible) :
--   - 'deals_won'         : count des deals.stage='won' sur la période
--   - 'revenue_collected' : sum des invoices.total payées sur la période
--   - 'leads_qualified'   : count lead_imports passés à status='qualified'
--
-- period_type : 'week'|'month'|'quarter'|'year' (libre, le calcul de
-- progression utilise [period_start, period_end] explicitement).
--
-- La progression n'est PAS persistée — elle est recalculée en runtime à
-- chaque chargement par `getGoalsWithProgress` (cf. lib/actions/goals.ts).
-- Si lent en prod, ajouter une table `goal_snapshots` v2.
-- ============================================================

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'team' check (scope in ('team','individual')),
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  check (
    (scope = 'team' and owner_profile_id is null)
    or (scope = 'individual' and owner_profile_id is not null)
  ),
  title text not null,
  description text,
  metric_type text not null check (metric_type in ('deals_won','revenue_collected','leads_qualified')),
  target_value numeric not null check (target_value > 0),
  period_type text not null check (period_type in ('week','month','quarter','year')),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_owner_idx on public.goals(owner_profile_id, status);
create index goals_period_idx on public.goals(period_start, period_end);

alter table public.goals enable row level security;
create policy goals_auth_select on public.goals for select to authenticated using (true);
create policy goals_auth_insert on public.goals for insert to authenticated with check (true);
create policy goals_auth_update on public.goals for update to authenticated using (true) with check (true);
create policy goals_auth_delete on public.goals for delete to authenticated using (true);

create or replace function public.set_updated_at_goals()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at_goals();

comment on table public.goals is
  'Objectifs CRM : équipe ou par-membre, sur metric_type avec progression auto recalculée à chaque chargement.';
