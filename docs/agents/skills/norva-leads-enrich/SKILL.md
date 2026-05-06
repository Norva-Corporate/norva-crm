---
name: norva-leads-enrich
description: Use this skill to safely UPDATE incomplete records (lead_imports, contacts, companies) in Norva. Provides SELECT queries to identify enrichment candidates (missing first_name/last_name/email/siret/sector/role) and idempotent UPDATE patterns that never overwrite existing non-null values without explicit reason. Always logs the enrichment action as an activity for traceability.
---

# Skill — Enrichissement de leads/contacts dans Norva

## Quand utiliser

Pour compléter en place les fiches incomplètes (lead_imports,
contacts, companies). À la différence de `norva-supabase-insert`,
cette skill fait des **UPDATE** et logge la trace.

## Outil requis

`mcp__supabase__execute_sql` (ou fallback REST API si MCP indisponible).

## Étape 1 — Identifier les candidats à enrichir

### Pour les leads `lead_imports` récents et incomplets

    SELECT id, source, external_id, email, first_name, last_name,
           phone, role, company_name, company_domain, raw_payload,
           imported_at
    FROM public.lead_imports
    WHERE status = 'pending'
      AND imported_at >= now() - interval '7 days'
      AND (
        first_name IS NULL OR
        last_name IS NULL OR
        (email IS NULL AND raw_payload->>'contact_email_personal' IS NULL) OR
        (raw_payload->>'siret') IS NULL OR
        (raw_payload->>'sector') IS NULL
      )
    ORDER BY imported_at DESC
    LIMIT 30;

### Pour les contacts existants peu renseignés

    SELECT c.id, c.first_name, c.last_name, c.email, c.role,
           c.company_id, co.name as company_name, co.domain
    FROM public.contacts c
    LEFT JOIN public.companies co ON co.id = c.company_id
    WHERE (c.email IS NULL OR c.role IS NULL OR c.phone IS NULL)
      AND c.created_at >= now() - interval '60 days'
    ORDER BY c.created_at DESC
    LIMIT 20;

## Étape 2 — Recherche pour chaque candidat

Pour chaque candidat :

1. Si `first_name` ou `last_name` ou `siret` manque → applique
   `prospection-enrichment-gouv` (API gouv) avec
   `q=<company_name>`, filtré par code postal si dispo
2. Si `email` manque ET on a un `company_domain` → applique
   `prospection-email-discovery` (mentions légales en priorité)
3. Si `raw_payload.sector` manque ET on a `nationalPhoneNumber` →
   utilise `types` Google Places via lookup secondaire si possible

## Étape 3 — UPDATE en sécurité (jamais d'écrasement intempestif)

**Règle absolue** : ne JAMAIS écraser une valeur non-null existante.
Utilise `COALESCE(<colonne>, '<nouvelle valeur>')` ou un `WHERE <colonne>
IS NULL` dans la clause.

### UPDATE sur lead_imports

    UPDATE public.lead_imports
    SET first_name = COALESCE(first_name, '<prénom trouvé>'),
        last_name  = COALESCE(last_name,  '<nom trouvé>'),
        email      = COALESCE(email,      '<email pro trouvé ou NULL>'),
        phone      = COALESCE(phone,      '<phone trouvé ou NULL>'),
        role       = COALESCE(role,       '<rôle trouvé ou NULL>'),
        company_domain = COALESCE(company_domain, '<domaine ou NULL>'),
        raw_payload = raw_payload || '<json delta>'::jsonb
    WHERE id = '<lead_id>';

Le `||` sur jsonb fait un **deep merge** : les nouvelles clés s'ajoutent,
les existantes sont remplacées par les nouvelles. Pour préserver les
clés existantes, **ne mets pas dans le delta** les clés déjà
renseignées.

### UPDATE sur contacts

    UPDATE public.contacts
    SET first_name = COALESCE(first_name, '<prénom>'),
        last_name  = COALESCE(last_name,  '<nom>'),
        email      = COALESCE(email,      '<email pro>'),
        phone      = COALESCE(phone,      '<phone>'),
        role       = COALESCE(role,       '<rôle>')
    WHERE id = '<contact_id>';

### UPDATE sur companies

    UPDATE public.companies
    SET domain  = COALESCE(domain,  '<domaine>'),
        sector  = COALESCE(sector,  '<secteur>'),
        size    = COALESCE(size,    '<taille>'),
        website = COALESCE(website, '<site>'),
        phone   = COALESCE(phone,   '<phone>')
    WHERE id = '<company_id>';

## Étape 4 — Tracer l'enrichissement (obligatoire)

Pour chaque entité enrichie, INSERT une activity :

    INSERT INTO public.activities
      (type, entity_type, entity_id, payload, created_by)
    VALUES (
      'note',
      <'contact' | 'company'>,
      '<entity_id>',
      jsonb_build_object(
        'body', 'Enrichi automatiquement par Agent Enrichissement',
        'fields_updated', '<liste séparée par virgules>',
        'sources', '<json array des sources utilisées>',
        'agent', 'multica-enrichissement',
        'timestamp', now()::text
      ),
      <ton uuid utilisateur>
    );

Note : pour `lead_imports`, on ne crée pas d'activity (la table n'a
pas de pendant côté `activities` car `entity_type` ne contient pas
`'lead_import'`). On peut juste enrichir `raw_payload.enrichment_log`
à la place.

## Étape 5 — Récap final pour l'utilisateur

Format :

    ## Enrichissement — <date>
    - Candidats scannés : N
    - Enrichis avec succès : M
    - Aucune donnée trouvée : K
    - Champs ajoutés (top 3) : first_name (12), email pro (4), siret (8)

    ## Détail
    | # | Type | Avant (manquant) | Après (ajouté) |
    |---|------|------------------|----------------|
    | 1 | lead | first_name, role | Marie Dupont, Gérante |

## Règles strictes

- ❌ **JAMAIS** d'UPDATE sans WHERE (= mass update accidentel)
- ❌ **JAMAIS** écraser une valeur non-null sans clause COALESCE
- ❌ Pas d'enrichissement si les données nouvelles sont moins fiables
  que celles existantes (ex. ne pas remplacer un email pro par un perso)
- ✅ Logger systématiquement dans `activities` pour traçabilité
- ✅ Limiter à 30 candidats par run (éviter de saturer les APIs)
- ✅ En cas d'erreur sur un candidat, passe au suivant — n'arrête pas
  toute la session
