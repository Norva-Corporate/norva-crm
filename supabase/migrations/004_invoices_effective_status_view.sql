-- ============================================================
-- 004 — View `invoices_with_effective_status`
-- ============================================================
-- Provides an "effective" status column that auto-promotes
-- `envoyee` invoices past their due_date to `en_retard`,
-- without mutating the underlying row.
--
-- The base `status` column on `public.invoices` keeps its
-- raw value. Existing UI code that reads the table directly
-- can be migrated incrementally to read from this view.
--
-- Idempotent : create or replace.
-- ============================================================

create or replace view public.invoices_with_effective_status
with (security_invoker = true)
as
select
  i.id,
  i.number,
  i.type,
  case
    when i.status = 'envoyee'
      and i.due_date is not null
      and i.due_date < current_date
      then 'en_retard'
    else i.status
  end as status,
  i.status as raw_status,
  i.project_id,
  i.contact_id,
  i.company_id,
  i.issue_date,
  i.due_date,
  i.subtotal,
  i.tax_rate,
  i.tax_amount,
  i.total,
  i.notes,
  i.created_by,
  i.created_at,
  i.updated_at
from public.invoices i;

comment on view public.invoices_with_effective_status is
  'Invoices with status auto-promoted to en_retard when due_date is past. raw_status keeps the underlying value.';
