-- ============================================================
-- 006 — Tasks, Activities, Notifications + auto-log triggers
-- ============================================================
-- Adds:
--   tasks         — todos liés à contact/company/deal/project ou libres
--   activities    — timeline générique alimentée par triggers + manuelle
--   notifications — in-app par user, exposée via Realtime
-- Plus auto-log triggers on deals/invoices/projects and notification
-- triggers on task assignment, deal reassignment, invoice paid.
-- ============================================================

-- TASKS
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date date,
  related_type text check (related_type in ('contact', 'company', 'deal', 'project')),
  related_id uuid,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_assigned_to_idx on public.tasks(assigned_to, status);
create index tasks_due_date_idx on public.tasks(due_date) where status not in ('done','cancelled');
create index tasks_related_idx on public.tasks(related_type, related_id);

alter table public.tasks enable row level security;

create policy "Authenticated users can view tasks" on public.tasks
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert tasks" on public.tasks
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);
create policy "Authenticated users can update tasks" on public.tasks
  for update using (auth.role() = 'authenticated');
create policy "Admins can delete tasks" on public.tasks
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

-- ACTIVITIES
create table public.activities (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  entity_type text not null
    check (entity_type in ('contact', 'company', 'deal', 'project', 'invoice')),
  entity_id uuid not null,
  payload jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index activities_entity_idx
  on public.activities(entity_type, entity_id, created_at desc);
create index activities_recent_idx on public.activities(created_at desc);

alter table public.activities enable row level security;

create policy "Authenticated users can view activities" on public.activities
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert activities" on public.activities
  for insert with check (auth.role() = 'authenticated');
create policy "Admins can delete activities" on public.activities
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users can update their own notifications" on public.notifications
  for update using (auth.uid() = user_id);
create policy "Service role can insert notifications" on public.notifications
  for insert with check (true);

-- AUTO ACTIVITIES — DEALS
create or replace function public.log_deal_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op = 'INSERT' then
    insert into public.activities(type, entity_type, entity_id, payload, created_by)
    values ('deal_created', 'deal', new.id,
      jsonb_build_object('title', new.title, 'value', new.value, 'stage', new.stage),
      actor);
    return new;
  end if;

  if tg_op = 'UPDATE' and old.stage is distinct from new.stage then
    insert into public.activities(type, entity_type, entity_id, payload, created_by)
    values ('deal_stage_changed', 'deal', new.id,
      jsonb_build_object('from', old.stage, 'to', new.stage, 'title', new.title),
      actor);
  end if;

  return new;
end;
$$;

drop trigger if exists log_deal_activity_trg on public.deals;
create trigger log_deal_activity_trg
  after insert or update of stage on public.deals
  for each row execute procedure public.log_deal_activity();

-- AUTO ACTIVITIES — INVOICES
create or replace function public.log_invoice_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op = 'INSERT' then
    insert into public.activities(type, entity_type, entity_id, payload, created_by)
    values ('invoice_created', 'invoice', new.id,
      jsonb_build_object('number', new.number, 'type', new.type, 'total', new.total, 'status', new.status),
      actor);
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.activities(type, entity_type, entity_id, payload, created_by)
    values ('invoice_status_changed', 'invoice', new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'number', new.number),
      actor);
  end if;

  return new;
end;
$$;

drop trigger if exists log_invoice_activity_trg on public.invoices;
create trigger log_invoice_activity_trg
  after insert or update of status on public.invoices
  for each row execute procedure public.log_invoice_activity();

-- AUTO ACTIVITIES — PROJECTS
create or replace function public.log_project_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op = 'INSERT' then
    insert into public.activities(type, entity_type, entity_id, payload, created_by)
    values ('project_created', 'project', new.id,
      jsonb_build_object('name', new.name, 'status', new.status, 'deal_id', new.deal_id),
      actor);
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.activities(type, entity_type, entity_id, payload, created_by)
    values ('project_status_changed', 'project', new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'name', new.name),
      actor);
  end if;

  return new;
end;
$$;

drop trigger if exists log_project_activity_trg on public.projects;
create trigger log_project_activity_trg
  after insert or update of status on public.projects
  for each row execute procedure public.log_project_activity();

-- NOTIFICATIONS — task assigned
create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  notify_user uuid;
begin
  if tg_op = 'INSERT' then
    notify_user := new.assigned_to;
  elsif tg_op = 'UPDATE' and new.assigned_to is distinct from old.assigned_to then
    notify_user := new.assigned_to;
  end if;

  if notify_user is null then
    return new;
  end if;

  if notify_user = coalesce(auth.uid(), new.created_by) then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, link)
  values (
    notify_user,
    'task_assigned',
    'Nouvelle tâche : ' || new.title,
    case when new.due_date is not null
      then 'Échéance : ' || to_char(new.due_date, 'DD/MM/YYYY')
      else null
    end,
    '/dashboard/taches'
  );

  return new;
end;
$$;

drop trigger if exists notify_task_assigned_trg on public.tasks;
create trigger notify_task_assigned_trg
  after insert or update of assigned_to on public.tasks
  for each row execute procedure public.notify_task_assigned();

-- NOTIFICATIONS — deal reassigned
create or replace function public.notify_deal_assigned()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if new.assigned_to is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  if new.assigned_to = actor then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, link)
  values (
    new.assigned_to,
    'deal_assigned',
    'Deal assigné : ' || new.title,
    case when new.value is not null
      then to_char(new.value, 'FM999G999G999D00') || ' €'
      else null
    end,
    '/dashboard/pipeline'
  );

  return new;
end;
$$;

drop trigger if exists notify_deal_assigned_trg on public.deals;
create trigger notify_deal_assigned_trg
  after insert or update of assigned_to on public.deals
  for each row execute procedure public.notify_deal_assigned();

-- NOTIFICATIONS — invoice paid
create or replace function public.notify_invoice_paid()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op = 'UPDATE' and new.status = 'payee' and old.status is distinct from 'payee' then
    if new.created_by is not null and new.created_by <> actor then
      insert into public.notifications(user_id, type, title, body, link)
      values (
        new.created_by,
        'invoice_paid',
        'Facture payée : ' || new.number,
        to_char(new.total, 'FM999G999G999D00') || ' €',
        '/dashboard/facturation/' || new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_invoice_paid_trg on public.invoices;
create trigger notify_invoice_paid_trg
  after update of status on public.invoices
  for each row execute procedure public.notify_invoice_paid();

-- REALTIME — expose notifications
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
