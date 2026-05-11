-- ============================================================
-- 023 — Tâches auto par projet (delivery TPE/artisans)
-- ============================================================
-- 1) Colonne `duration_days` (smallint, default 14) sur projects
--    pour moduler les délais des tâches auto.
-- 2) Fonction `create_default_project_tasks(p_project_id uuid)` :
--    crée 8 tâches (acompte, brief, maquette, dev, recette,
--    solde, mise en ligne, contrat de maintenance optionnel)
--    avec délais proportionnels à `duration_days`. Idempotent
--    (skip si déjà créées via marqueur `auto_origin`).
-- 3) Trigger AFTER INSERT ON projects → appelle la fonction.
-- 4) Trigger AFTER UPDATE OF status → cancel les tâches pending
--    quand le projet passe en `termine` ou `annule`.
-- 5) Trigger AFTER UPDATE OF assigned_to → réassigne les tâches
--    pending auto-créées au nouveau responsable.
-- ============================================================

-- 1. Colonne durée modulable
alter table public.projects
  add column if not exists duration_days smallint not null default 14
    check (duration_days > 0 and duration_days <= 180);

-- 2. Fonction de création des tâches par défaut
create or replace function public.create_default_project_tasks(p_project_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_duration int;
  v_start date;
  v_assignee uuid;
  v_creator uuid;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then return; end if;

  -- Idempotent : ne refait pas si déjà créées
  if exists (
    select 1 from public.tasks
    where related_type='project' and related_id=p_project_id
      and auto_origin like 'project_setup:%'
  ) then
    return;
  end if;

  v_duration := coalesce(v_project.duration_days, 14);
  v_start := coalesce(v_project.start_date, current_date);
  v_assignee := v_project.assigned_to;
  v_creator := v_project.created_by;

  insert into public.tasks
    (title, description, status, priority, due_date,
     related_type, related_id, assigned_to, created_by, auto_origin)
  values
    ('Émettre la facture d''acompte (30 %)',
     'À envoyer dès la signature du devis.',
     'pending', 'high',
     v_start + 1,
     'project', p_project_id, v_assignee, v_creator,
     'project_setup:acompte'),

    ('Recueillir le brief client',
     'Pages, contenu, ton, références. Cadrer le besoin avant maquette.',
     'pending', 'high',
     v_start + greatest(1, (v_duration * 0.10)::int),
     'project', p_project_id, v_assignee, v_creator,
     'project_setup:brief'),

    ('Préparer la maquette',
     'Designer les écrans clés (home, intérieures, mobile).',
     'pending', 'normal',
     v_start + greatest(2, (v_duration * 0.30)::int),
     'project', p_project_id, v_assignee, v_creator,
     'project_setup:maquette'),

    ('Développer le site',
     'Conception technique + intégration des maquettes.',
     'pending', 'normal',
     v_start + greatest(4, (v_duration * 0.55)::int),
     'project', p_project_id, v_assignee, v_creator,
     'project_setup:dev'),

    ('Recette + corrections',
     'Validation client, corrections, optimisations finales.',
     'pending', 'normal',
     v_start + greatest(6, (v_duration * 0.80)::int),
     'project', p_project_id, v_assignee, v_creator,
     'project_setup:recette'),

    ('Émettre la facture solde (70 %)',
     'Préparer + envoyer la facture de solde avant mise en ligne.',
     'pending', 'high',
     v_start + greatest(7, (v_duration * 0.85)::int),
     'project', p_project_id, v_assignee, v_creator,
     'project_setup:solde'),

    ('Mettre en ligne le site',
     'Déploiement final, configurations DNS/email, tests post-prod.',
     'pending', 'high',
     v_start + v_duration,
     'project', p_project_id, v_assignee, v_creator,
     'project_setup:launch'),

    ('Proposer un contrat de maintenance',
     'Relancer le client J+7 après lancement pour souscrire à la maintenance.',
     'pending', 'normal',
     v_start + v_duration + 7,
     'project', p_project_id, v_assignee, v_creator,
     'project_setup:maintenance');
end;
$$;

-- 3. Trigger AFTER INSERT ON projects
create or replace function public.projects_setup_tasks_trigger()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  perform public.create_default_project_tasks(new.id);
  return new;
end;
$$;

drop trigger if exists projects_setup_tasks on public.projects;
create trigger projects_setup_tasks
  after insert on public.projects
  for each row execute procedure public.projects_setup_tasks_trigger();

-- 4. Trigger AFTER UPDATE OF status — cancel pending tasks quand projet clos
create or replace function public.projects_close_cancel_tasks_trigger()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.status in ('termine', 'annule')
     and old.status not in ('termine', 'annule')
  then
    update public.tasks
    set status = 'cancelled'
    where related_type = 'project'
      and related_id = new.id
      and status = 'pending'
      and auto_origin like 'project_setup:%';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_close_cancel_tasks on public.projects;
create trigger projects_close_cancel_tasks
  after update of status on public.projects
  for each row execute procedure public.projects_close_cancel_tasks_trigger();

-- 5. Trigger AFTER UPDATE OF assigned_to — réassigne les tâches pending
create or replace function public.projects_reassign_tasks_trigger()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.assigned_to is distinct from old.assigned_to then
    update public.tasks
    set assigned_to = new.assigned_to
    where related_type = 'project'
      and related_id = new.id
      and status = 'pending'
      and auto_origin like 'project_setup:%';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_reassign_tasks on public.projects;
create trigger projects_reassign_tasks
  after update of assigned_to on public.projects
  for each row execute procedure public.projects_reassign_tasks_trigger();
