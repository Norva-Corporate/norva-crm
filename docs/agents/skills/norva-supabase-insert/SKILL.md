---
name: norva-supabase-insert
description: Use this skill whenever you need to write data (leads, contacts, activities, tasks, notifications) to the Norva CRM Supabase database. Provides the exact INSERT SQL templates, anti-duplication SELECT procedures, raw_payload conventions, and column reference for each main Norva table. All writes must go through the mcp__supabase__execute_sql tool.
---

# Skill — INSERT dans Norva (Supabase)

## Quand utiliser cette skill

À chaque écriture finale d'un agent vers le CRM Norva (lead converti,
note ajoutée, tâche créée, etc.).

## Outil requis

`mcp__supabase__execute_sql`

Chargé via le flag `--mcp-config <path>` dans les Custom Args de
l'agent multica. Si l'outil n'est pas trouvé, arrête immédiatement avec
un message clair pour l'utilisateur.

## Table `lead_imports` (cas principal — nouveaux prospects)

### Schéma utile

| Colonne | Type | Notes |
|---|---|---|
| `source` | text | toujours `multica-<nom-agent>` (ex. `multica-prospection`) |
| `external_id` | text | ID stable (place_id Google, URL LinkedIn, SIRET, hash) |
| `email` | text | minuscules, NULL si non trouvé ou perso |
| `first_name`, `last_name` | text | dirigeant principal |
| `phone` | text | format international `+33 X XX XX XX XX` |
| `role` | text | fonction (vocabulaire contrôlé du prompt agent) |
| `company_name` | text | obligatoire |
| `company_domain` | text | extrait de l'email pro, NULL si email perso |
| `raw_payload` | jsonb | tout le contexte enrichi |

### Anti-doublon (OBLIGATOIRE avant chaque INSERT)

    SELECT id, status FROM public.lead_imports
    WHERE source = '<source>'
      AND (
        external_id = '<external_id>' OR
        (email IS NOT NULL AND lower(email) = lower('<email>')) OR
        company_name ILIKE '<nom>'
      );

    SELECT id FROM public.contacts
    WHERE email IS NOT NULL AND lower(email) = lower('<email>');

Si match → SKIP, mentionne dans le récap final.

### INSERT

    INSERT INTO public.lead_imports
      (source, external_id, email, first_name, last_name, phone, role,
       company_name, company_domain, raw_payload)
    VALUES
      ('<source>',
       '<external_id>',
       <email lowercase ou NULL>,
       <first_name ou NULL>,
       <last_name ou NULL>,
       <phone formaté ou NULL>,
       <role ou NULL>,
       '<company_name>',
       <company_domain ou NULL>,
       '<json valide>'::jsonb);

## Table `activities` (timeline d'un contact/deal/projet)

Pour journaliser une action manuelle (note, appel, RDV, email).

    INSERT INTO public.activities
      (type, entity_type, entity_id, payload, created_by)
    VALUES
      ('note',                     -- ou 'call' / 'meeting' / 'email'
       'contact',                  -- ou 'deal' / 'project' / 'company' / 'invoice'
       '<uuid de l'entité>',
       '{"body": "<texte>"}'::jsonb,
       '<auth.uid()>');

## Table `tasks` (todos)

    INSERT INTO public.tasks
      (title, description, status, priority, due_date,
       related_type, related_id, assigned_to, created_by)
    VALUES
      ('<titre>',
       <description ou NULL>,
       'pending',                  -- ou 'in_progress' / 'done' / 'cancelled'
       'normal',                   -- ou 'low' / 'high' / 'urgent'
       <date YYYY-MM-DD ou NULL>,
       <'contact'|'company'|'deal'|'project' ou NULL>,
       <uuid lié ou NULL>,
       <assignee uuid ou NULL>,
       '<creator uuid>');

## Conventions `raw_payload` (jsonb)

Clés courantes recommandées :

- `score` (0.0 - 1.0)
- `priority` ("Oui" / "Non")
- `score_breakdown` (objet : `fit`, `pain`, `reach`, `budget`)
- `sector` (du vocabulaire contrôlé)
- `location` (ville / quartier)
- `address` (adresse complète)
- `siret` (14 chiffres)
- `headcount` (texte : "1-2 salariés", "10-50", etc.)
- `linkedin`, `website`, `twitter` (URLs ou null)
- `tags` (array de strings, vocabulaire contrôlé)
- `notes` (texte libre)
- `sources` (array : `["google-places-api", "pages-jaunes"]`)
- `scraped_at` (ISO timestamp)
- `estimated_value_eur` (number)
- `next_followup_date` (YYYY-MM-DD)
- `site_audit` (objet — voir skill `prospection-site-audit`)
- `contact_email_personal` (string si email perso trouvé)
- `google_rating`, `review_count` (depuis Places API)
- `place_id` (format `places/ChIJ...`)

## Sécurité / RLS

Les inserts via le MCP Supabase utilisent un Personal Access Token
qui contourne la RLS. Pas de risque de blocage RLS, **mais** :

- ❌ Ne jamais SELECT puis afficher de données contenant des emails
  perso sans masquage (`***@gmail.com`)
- ❌ Ne jamais DROP / TRUNCATE / DELETE en bulk
- ✅ Toujours scope par `source` quand tu lis (évite de toucher les
  leads d'autres agents)

## Erreurs courantes

| Erreur | Cause probable | Fix |
|--------|----------------|-----|
| `duplicate key value violates unique constraint` | INSERT concurrent même `external_id` | Refaire le SELECT anti-doublon, SKIP |
| `invalid input syntax for type uuid` | UUID malformé (ex. place_id mis dans un champ uuid) | `external_id` est text, pas uuid — ne mets jamais place_id ailleurs |
| `null value in column "X" violates not-null constraint` | Champ obligatoire manquant | Vérifier les NOT NULL : `source`, `company_name`, etc. |
| `permission denied for table` | PAT Supabase invalide ou révoqué | Régénérer le token, mettre à jour `norva-mcp.json` |
