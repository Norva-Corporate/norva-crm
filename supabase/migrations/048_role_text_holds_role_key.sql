-- ============================================================
-- 048 — profiles.role text stocke la role_key réelle (admin / member / custom)
-- ============================================================
-- Suite de 047. Le trigger initial sync_profile_role_text() forçait
-- `profiles.role` à 'member' pour tout rôle custom (laurent, manager, etc.).
-- Confusion : dans Supabase Studio on voyait toujours 'member' alors que
-- l'assignation marchait via `role_id`. On corrige :
--
--   1. Drop du CHECK qui n'autorisait que ('admin','member').
--   2. Trigger réécrit pour stocker la `role_key` complète.
--   3. Backfill des profils existants pour aligner `role` sur leur role_id.
--
-- Sécurité : audit confirmé — AUCUNE policy RLS ne lit `role = 'member'`.
-- Les policies legacy lisent uniquement `role = 'admin'`, qui reste vrai
-- pour le rôle système admin (key 'admin' → text 'admin'). Pour les autres
-- rôles, `role <> 'admin'` est interprété comme non-admin par les RLS, ce
-- qui est le comportement attendu pour la sécurité.
-- ============================================================

-- 1. Drop du CHECK trop strict
alter table public.profiles drop constraint if exists profiles_role_check;

-- 2. Backfill : aligner `role` sur la role_key actuelle pour les profils
--    dont le rôle a déjà été assigné via role_id (rôles custom).
update public.profiles p
set role = r.key
from public.roles r
where p.role_id = r.id
  and p.role <> r.key;

-- 3. Trigger : stocker la role_key complète au lieu du mapping forcé admin/member
create or replace function public.sync_profile_role_text()
returns trigger
language plpgsql
as $$
declare
  role_key text;
begin
  if new.role_id is null then
    return new;
  end if;

  select r.key into role_key from public.roles r where r.id = new.role_id;
  if role_key is not null then
    new.role := role_key;
  end if;
  return new;
end;
$$;

-- Le trigger lui-même n'a pas besoin d'être recréé (la signature ne change pas),
-- mais on le redéclare par sécurité au cas où sa cible aurait été altérée.
drop trigger if exists sync_profile_role_text_trg on public.profiles;
create trigger sync_profile_role_text_trg
  before insert or update of role_id on public.profiles
  for each row execute procedure public.sync_profile_role_text();
