-- ============================================================
-- 021 — Fix encodage (U+FFFD replacement chars)
-- ============================================================
-- Certains agents Multica produisent du texte mal encodé qui
-- arrive en DB avec le replacement char U+FFFD (bytes ef bf bd,
-- visible comme `?` dans l'UI). On nettoie + on installe un
-- trigger qui empêche les futures insertions corrompues.
-- ============================================================

-- Fonction de nettoyage : remplace les patterns FR connus, puis
-- silencieusement strip les chr(65533) restants.
create or replace function public.clean_replacement_chars(t text)
returns text language plpgsql immutable as $$
declare
  rchar text := chr(65533); -- U+FFFD
begin
  if t is null then return null; end if;

  -- Cas observés sur les leads existants (TPE/artisans FR)
  t := replace(t, 'G' || rchar || 'rant', 'Gérant');
  t := replace(t, 'g' || rchar || 'rant', 'gérant');
  t := replace(t, 'Pr' || rchar || 'sident', 'Président');
  t := replace(t, 'pr' || rchar || 'sident', 'président');
  t := replace(t, 'ST' || rchar || 'PHANE', 'STÉPHANE');
  t := replace(t, 'St' || rchar || 'phane', 'Stéphane');
  t := replace(t, 'P' || rchar || 'tit', 'P''tit');
  t := replace(t, rchar || 'lectricien', 'Électricien');
  t := replace(t, rchar || 'lectricienne', 'Électricienne');
  t := replace(t, rchar || 'lectrique', 'Électrique');
  t := replace(t, rchar || 'lec', 'Élec');
  -- Cas FR fréquents
  t := replace(t, 'Caf' || rchar, 'Café');
  t := replace(t, 'caf' || rchar, 'café');
  t := replace(t, 'Soci' || rchar || 't' || rchar, 'Société');
  t := replace(t, 'soci' || rchar || 't' || rchar, 'société');
  t := replace(t, 'March' || rchar, 'Marché');
  t := replace(t, 'march' || rchar, 'marché');
  t := replace(t, 'Sant' || rchar, 'Santé');
  t := replace(t, 'sant' || rchar, 'santé');
  t := replace(t, 'D' || rchar || 'coration', 'Décoration');
  t := replace(t, 'd' || rchar || 'coration', 'décoration');
  t := replace(t, 'R' || rchar || 'novation', 'Rénovation');
  t := replace(t, 'r' || rchar || 'novation', 'rénovation');
  t := replace(t, 'R' || rchar || 'paration', 'Réparation');
  t := replace(t, 'r' || rchar || 'paration', 'réparation');
  t := replace(t, 'B' || rchar || 'timent', 'Bâtiment');
  t := replace(t, 'b' || rchar || 'timent', 'bâtiment');
  t := replace(t, 'P' || rchar || 'tisserie', 'Pâtisserie');
  t := replace(t, 'p' || rchar || 'tisserie', 'pâtisserie');
  t := replace(t, 'B' || rchar || 'b' || rchar, 'Bébé');
  t := replace(t, 'Cr' || rchar || 'ation', 'Création');
  t := replace(t, 'cr' || rchar || 'ation', 'création');
  t := replace(t, 'Sp' || rchar || 'cialiste', 'Spécialiste');
  t := replace(t, 'G' || rchar || 'n' || rchar || 'ral', 'Général');
  t := replace(t, 'g' || rchar || 'n' || rchar || 'ral', 'général');
  t := replace(t, 'Pr' || rchar || 'paration', 'Préparation');
  t := replace(t, 'Imm' || rchar || 'diat', 'Immédiat');

  -- Silent fallback : tout chr(65533) restant disparaît
  t := replace(t, rchar, '');

  return t;
end;
$$;

-- Trigger générique réutilisable : nettoie les colonnes texte communes
create or replace function public.clean_encoding_trigger()
returns trigger language plpgsql as $$
begin
  if TG_TABLE_NAME = 'companies' then
    new.name := public.clean_replacement_chars(new.name);
    new.notes := public.clean_replacement_chars(new.notes);
    new.address := public.clean_replacement_chars(new.address);
  elsif TG_TABLE_NAME = 'contacts' then
    new.first_name := public.clean_replacement_chars(new.first_name);
    new.last_name := public.clean_replacement_chars(new.last_name);
    new.role := public.clean_replacement_chars(new.role);
    new.notes := public.clean_replacement_chars(new.notes);
  elsif TG_TABLE_NAME = 'lead_imports' then
    new.first_name := public.clean_replacement_chars(new.first_name);
    new.last_name := public.clean_replacement_chars(new.last_name);
    new.role := public.clean_replacement_chars(new.role);
    new.company_name := public.clean_replacement_chars(new.company_name);
    new.notes := public.clean_replacement_chars(new.notes);
  end if;
  return new;
end;
$$;

drop trigger if exists lead_imports_clean_encoding on public.lead_imports;
create trigger lead_imports_clean_encoding
  before insert or update on public.lead_imports
  for each row execute procedure public.clean_encoding_trigger();

drop trigger if exists contacts_clean_encoding on public.contacts;
create trigger contacts_clean_encoding
  before insert or update on public.contacts
  for each row execute procedure public.clean_encoding_trigger();

drop trigger if exists companies_clean_encoding on public.companies;
create trigger companies_clean_encoding
  before insert or update on public.companies
  for each row execute procedure public.clean_encoding_trigger();

-- Backfill : nettoie les données existantes en passant par les triggers
update public.lead_imports
set first_name = first_name
where first_name like '%' || chr(65533) || '%'
   or last_name like '%' || chr(65533) || '%'
   or role like '%' || chr(65533) || '%'
   or company_name like '%' || chr(65533) || '%'
   or notes like '%' || chr(65533) || '%';

update public.contacts
set first_name = first_name
where first_name like '%' || chr(65533) || '%'
   or last_name like '%' || chr(65533) || '%'
   or role like '%' || chr(65533) || '%'
   or notes like '%' || chr(65533) || '%';

update public.companies
set name = name
where name like '%' || chr(65533) || '%'
   or notes like '%' || chr(65533) || '%'
   or address like '%' || chr(65533) || '%';
