-- ============================================================
-- 010 — AGENT_TASKS queue
-- ============================================================
-- File d'attente de tâches IA déclenchées depuis Norva
-- (boutons "✨ Générer kit", "Auditer site", "Enrichir", etc.)
-- Les agents multica polent cette table, traitent les tasks
-- et marquent done en INSERT-ant les résultats dans activities,
-- contacts, lead_imports, etc.
-- ============================================================

create table public.agent_tasks (
  id uuid primary key default uuid_generate_v4(),
  agent text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error', 'cancelled')),
  entity_type text check (entity_type in ('contact', 'company', 'deal', 'project', 'lead_import')),
  entity_id uuid,
  context jsonb not null default '{}'::jsonb,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error text
);

create index agent_tasks_pending_idx
  on public.agent_tasks(agent, created_at)
  where status = 'pending';
create index agent_tasks_entity_idx
  on public.agent_tasks(entity_type, entity_id);
create index agent_tasks_recent_idx on public.agent_tasks(created_at desc);

alter table public.agent_tasks enable row level security;

create policy "Authenticated users can view agent_tasks" on public.agent_tasks
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert agent_tasks" on public.agent_tasks
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update agent_tasks" on public.agent_tasks
  for update using (auth.role() = 'authenticated');
create policy "Admins can delete agent_tasks" on public.agent_tasks
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agent_tasks'
  ) then
    alter publication supabase_realtime add table public.agent_tasks;
  end if;
end $$;
