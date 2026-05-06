---
name: norva-agent-queue
description: Use this skill at the start of any agent run to pull pending tasks from the agent_tasks queue table in Norva. Marks tasks as 'running' on claim, processes them one by one, then marks 'done' (with result) or 'error'. Used by all Norva-triggered agents (Premier Contact, Enrichissement, Audit Site, Re-scoring deal). Fetches the linked entity context (contact, deal, company, etc.) for each task.
---

# Skill — File d'attente agent_tasks de Norva

## Quand utiliser

Au début de chaque agent qui peut être déclenché depuis le bouton ✨
de Norva. Tous les agents listés ci-dessous suivent ce pattern :

- `premier-contact`
- `enrichissement`
- `audit-site`
- `rescoring-deal`

## Outil requis

`mcp__supabase__execute_sql` (ou fallback REST API service_role).

## Étape 1 — Identifier l'agent appelant

L'agent connaît son nom (du prompt système) — ex. `premier-contact`.

## Étape 2 — Claim des pending tasks (UPDATE atomique)

Pour éviter qu'un autre run prenne les mêmes tasks (rare mais propre) :

    UPDATE public.agent_tasks
    SET status = 'running', started_at = now()
    WHERE id IN (
      SELECT id FROM public.agent_tasks
      WHERE agent = '<nom-agent>'
        AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;

Récupère le résultat — c'est ta liste de tasks à traiter.

Si aucune ligne retournée → "File vide, rien à faire" → exit.

## Étape 3 — Pour chaque task : récupérer le contexte de l'entité

Selon `entity_type` et `entity_id` :

### contact

    SELECT c.*, co.name as company_name, co.domain as company_domain,
           co.sector as company_sector, co.size as company_size
    FROM public.contacts c
    LEFT JOIN public.companies co ON co.id = c.company_id
    WHERE c.id = '<entity_id>';

### deal

    SELECT d.*,
           c.first_name as contact_first_name,
           c.last_name as contact_last_name,
           c.email as contact_email,
           co.name as company_name
    FROM public.deals d
    LEFT JOIN public.contacts c ON c.id = d.contact_id
    LEFT JOIN public.companies co ON co.id = d.company_id
    WHERE d.id = '<entity_id>';

### company

    SELECT co.*,
      (SELECT count(*) FROM public.contacts c WHERE c.company_id = co.id) as contact_count
    FROM public.companies co
    WHERE co.id = '<entity_id>';

### lead_import

    SELECT * FROM public.lead_imports WHERE id = '<entity_id>';

### project

    SELECT p.*, d.title as deal_title
    FROM public.projects p
    LEFT JOIN public.deals d ON d.id = p.deal_id
    WHERE p.id = '<entity_id>';

## Étape 4 — Traiter la task

Application des skills métier propres à l'agent. Ex pour
`premier-contact` : applique `pain-digital-detection` puis
`redaction-cold-outreach` puis insère 4 `activities`.

**Important** : utilise `task.context` pour les params optionnels
passés depuis Norva (canal préféré, ton override, etc.).

## Étape 5 — Marquer la task comme terminée

### Si succès

    UPDATE public.agent_tasks
    SET status = 'done',
        completed_at = now(),
        result = '<jsonb avec le résumé>'::jsonb
    WHERE id = '<task_id>';

`result` peut contenir :
- Pour `premier-contact` : `{ activities_created: 4, pain_id: "no_website" }`
- Pour `enrichissement` : `{ fields_updated: ["first_name", "email", "siret"] }`
- Pour `audit-site` : `{ pains_detected: ["no_https", "no_booking"] }`
- Pour `rescoring-deal` : `{ old_score: 0.62, new_score: 0.81 }`

### Si erreur

    UPDATE public.agent_tasks
    SET status = 'error',
        completed_at = now(),
        error = '<message court de l erreur>'
    WHERE id = '<task_id>';

## Étape 6 — Récap final pour l'utilisateur

    ## Run agent <nom> — <date>
    - Tasks claimed : N
    - Done : M
    - Error : K
    - Détails :
      - <id court> · <entity> · <result short>

## Règles strictes

- ❌ JAMAIS de SELECT pending sans UPDATE → garantit qu'on ne traite
  pas 2 fois la même task
- ❌ Si une task plante, marque-la error et passe à la suivante. Ne
  fais pas crasher tout le run.
- ✅ Limite à 10 tasks par run pour éviter de monopoliser une session
  longue
- ✅ Le `result` jsonb sert de log — ajoute toutes les métriques utiles
  (counts, ids créés, durée, etc.)
- ✅ Si `entity_id` est null, lis `task.context` pour les params libres
