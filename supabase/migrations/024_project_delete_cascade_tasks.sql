-- ============================================================
-- 024 — Cascade DELETE des tâches quand le projet est supprimé
-- ============================================================
-- Quand un projet est supprimé via deleteProject (ou SQL direct),
-- on supprime aussi toutes ses tâches liées (related_type='project'
-- + related_id=projet). Évite les tâches orphelines qui polluent
-- la page Tâches et le calendrier.
--
-- Note : ce trigger ne touche PAS aux tâches d'un projet
-- simplement passé à `termine` ou `annule` (cas géré par 023 :
-- les pending auto-créées passent en `cancelled`, les autres
-- restent). C'est seulement le DELETE qui purge tout.
-- ============================================================

create or replace function public.projects_delete_cascade_tasks_trigger()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.tasks
  where related_type = 'project'
    and related_id = old.id;
  return old;
end;
$$;

drop trigger if exists projects_delete_cascade_tasks on public.projects;
create trigger projects_delete_cascade_tasks
  before delete on public.projects
  for each row execute procedure public.projects_delete_cascade_tasks_trigger();
