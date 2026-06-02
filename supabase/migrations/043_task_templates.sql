-- ============================================================
-- 043 — task_templates
-- ============================================================
-- Templates de listes de tâches réutilisables (ex: "Onboarding client"
-- = 5 tâches préfigurées). On les applique à un deal ou un projet via
-- `applyTaskTemplate` (server action), qui boucle sur `items` et crée
-- N tâches avec leur due_date relative.
--
-- Pas de table relationnelle items séparée : le JSON suffit pour ≤20
-- items par template (cas usage typique). Si on a besoin de tracker
-- l'usage par item ou de versionning, on créera task_template_items v2.
-- ============================================================

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- 'global' : sélectionnable depuis n'importe quelle entité.
  -- 'deal'   : visible uniquement dans le picker du DealDrawer.
  -- 'project': visible uniquement dans le picker du ProjectDrawer.
  scope text not null default 'global' check (scope in ('global','deal','project')),
  -- items = liste d'objets { title, description?, priority, due_offset_days }
  -- title (string, required), priority ('low'|'medium'|'high'),
  -- due_offset_days (int) — jours à ajouter à la date d'application.
  items jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_templates_scope_idx on public.task_templates(scope);

alter table public.task_templates enable row level security;
create policy task_templates_select on public.task_templates
  for select to authenticated using (true);
create policy task_templates_insert on public.task_templates
  for insert to authenticated with check (true);
create policy task_templates_update on public.task_templates
  for update to authenticated using (true) with check (true);
create policy task_templates_delete on public.task_templates
  for delete to authenticated using (true);

create or replace function public.set_updated_at_task_templates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger task_templates_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at_task_templates();

comment on table public.task_templates is
  'Templates de listes de tâches réutilisables. items = jsonb [{title, description?, priority, due_offset_days}]';
