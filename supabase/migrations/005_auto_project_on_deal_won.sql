-- ============================================================
-- 005 — Auto-create a project when a deal is moved to `won`
-- ============================================================
-- Trigger fires AFTER INSERT or UPDATE of stage on `deals`.
-- - Only acts when the new stage is `won`
-- - Skips if a project already exists for this deal (idempotent
--   when a deal cycles negotiation → won → negotiation → won)
-- - Skips when the previous row was already at `won` to avoid
--   double inserts on unrelated updates of a won deal
--
-- Idempotent : `create or replace function`, drop+create trigger.
-- ============================================================

create or replace function public.create_project_for_won_deal()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  -- Only when the deal is now 'won'
  if new.stage <> 'won' then
    return new;
  end if;

  -- On UPDATE: skip if it was already 'won' (no transition)
  if tg_op = 'UPDATE' and old.stage = 'won' then
    return new;
  end if;

  -- Skip if a project already exists for this deal
  if exists (select 1 from public.projects where deal_id = new.id) then
    return new;
  end if;

  insert into public.projects (
    name,
    deal_id,
    status,
    budget,
    assigned_to,
    created_by
  ) values (
    new.title,
    new.id,
    'en_attente',
    new.value,
    new.assigned_to,
    new.created_by
  );

  return new;
end;
$$;

drop trigger if exists on_deal_won_create_project on public.deals;
create trigger on_deal_won_create_project
  after insert or update of stage on public.deals
  for each row execute procedure public.create_project_for_won_deal();
