-- Migration 049 — corriger clean_encoding_trigger() après la 048.
--
-- La 048 a droppé `notes` sur contacts/companies/lead_imports, mais le
-- trigger BEFORE INSERT OR UPDATE installé par la 021 référence encore
-- `new.notes` → toute mutation sur ces tables échoue avec :
--   "record \"new\" has no field \"notes\""
-- (visible quand on dismiss un lead, ajoute un contact, etc.)
--
-- On redéfinit la fonction sans les références à `new.notes`. La fonction
-- `clean_replacement_chars(text)` est inchangée — elle reste utilisable
-- pour invoices.notes (le seul champ `notes` encore en base).

create or replace function public.clean_encoding_trigger()
returns trigger language plpgsql as $$
begin
  if TG_TABLE_NAME = 'companies' then
    new.name := public.clean_replacement_chars(new.name);
    new.address := public.clean_replacement_chars(new.address);
  elsif TG_TABLE_NAME = 'contacts' then
    new.first_name := public.clean_replacement_chars(new.first_name);
    new.last_name := public.clean_replacement_chars(new.last_name);
    new.role := public.clean_replacement_chars(new.role);
  elsif TG_TABLE_NAME = 'lead_imports' then
    new.first_name := public.clean_replacement_chars(new.first_name);
    new.last_name := public.clean_replacement_chars(new.last_name);
    new.role := public.clean_replacement_chars(new.role);
    new.company_name := public.clean_replacement_chars(new.company_name);
  end if;
  return new;
end;
$$;
