---
name: prospection-bodacc-check
description: Use this skill to verify if a French company is still legally alive by checking the BODACC (Bulletin Officiel des Annonces Civiles et Commerciales) for radiation, judicial proceedings (redressement/liquidation), or recent leadership changes. Uses the free opendatasoft API (no auth, no quota). Returns a boolean company_active and the latest relevant announcement details. Essential to avoid prospecting companies that no longer exist or are in bankruptcy.
---

# Skill — Vérification BODACC (entreprise active)

## Quand utiliser

Systématiquement à l'INSERT d'un lead, dès que tu as un **SIREN**
récupéré via `prospection-enrichment-gouv`. Sans SIREN, on ne peut pas
checker → `company_active = NULL` (inconnu).

## Pourquoi c'est important

Une entreprise immatriculée à l'API gouv (Sirene) peut être :

- **Radiée** depuis quelques mois (Sirene est lent à se mettre à jour)
- **En procédure collective** (redressement judiciaire, liquidation)
- **Cédée** à un nouveau dirigeant (le prénom/nom récupéré peut être
  périmé)

Le BODACC publie en temps réel les annonces légales. C'est LA source de
vérité pour savoir si une boîte est encore en vie.

## API utilisée

**Endpoint gratuit, sans auth, illimité** :

    https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records

Paramètres :

- `where=registre%20like%20%22<SIREN>%22` — filtre par SIREN
- `order_by=dateparution%20desc` — annonces récentes d'abord
- `limit=10` — 10 dernières suffisent

Exemple via Bash :

    SIREN=552120222
    curl "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?where=registre%20like%20%22$SIREN%22&order_by=dateparution%20desc&limit=10"

## Champs utiles dans la réponse

Chaque résultat dans `results[]` contient :

- `dateparution` — date de l'annonce (YYYY-MM-DD)
- `familleavis` — famille d'annonce :
  - `creation` — création d'entreprise
  - `modification` — changement (gérant, capital, siège, etc.)
  - `vente` — cession
  - `radiation` — RADIATION ⚠️
  - `collectives` — procédure collective ⚠️
  - `depot` — dépôt des comptes (signal positif)
  - `rectificatif` — rectification d'une annonce précédente
- `typeavis_lib` — libellé court ("Radiation", "Jugement de
  liquidation judiciaire", "Plan de cession", etc.)
- `tribunal` — tribunal qui a publié
- `commercant` — nom commercial
- `numerodepartement` — département (utile cross-check)

## Logique de décision

```
Récupère les 10 dernières annonces (les plus récentes en premier).

Pour chaque annonce, en partant de la plus récente :
  - Si familleavis = 'radiation' → company_active = false. STOP.
  - Si typeavis_lib contient 'liquidation' → company_active = false. STOP.
  - Si typeavis_lib contient 'redressement' → company_active = true
    MAIS warning dans raw_payload (entreprise en difficulté). STOP.
  - Sinon, continue à l'annonce suivante.

Si aucune annonce de radiation/liquidation en 10 dernières → company_active = true.

Si l'API renvoie 0 résultat (SIREN pas dans BODACC) :
  → company_active = true (par défaut, si Sirene la connaît elle existe)
  Note : nombreuses TPE n'apparaissent jamais en BODACC (pas
  d'événements légaux à publier).
```

## Output — UPDATE à appliquer

    UPDATE public.lead_imports
    SET company_active = <true|false>,
        verified_at = now(),
        raw_payload = raw_payload || jsonb_build_object(
          'bodacc_check', jsonb_build_object(
            'checked_at', now()::text,
            'siren', '<SIREN>',
            'last_announcement', jsonb_build_object(
              'date', '<dateparution>',
              'famille', '<familleavis>',
              'type', '<typeavis_lib>'
            ),
            'warning', '<null | "redressement_en_cours" | "radiee">'
          )
        )
    WHERE id = '<lead_id>';

## Signal complémentaire — changement de dirigeant récent

Si une annonce de `modification` < 12 mois mentionne un changement de
gérant, le `first_name`/`last_name` récupérés par l'API gouv peuvent
être périmés.

Pattern à chercher dans `typeavis_lib` ou `listepersonnes` :

- "Changement de gérant"
- "Modification du représentant légal"
- "Nouveau président"

Si match :

    raw_payload || jsonb_build_object(
      'leadership_change_detected', jsonb_build_object(
        'date', '<dateparution>',
        'note', 'Annonce BODACC récente — vérifier le dirigeant actuel'
      )
    )

→ Côté CRM, ce flag affichera un badge ⚠️ "Dirigeant à confirmer" dans
la carte du kanban.

## Cas spéciaux

### Pas de SIREN

Si l'enrichissement gouv n'a pas matché et qu'on n'a pas de SIREN :
**skip la skill**. `company_active = NULL` (inconnu).

### Auto-entrepreneur / micro-entreprise

Ils ont un SIREN mais publient rarement en BODACC. Aucune annonce =
toujours actif par défaut.

### Association loi 1901

Pas de SIREN au sens BODACC → skip. Vérifier sur
`https://www.journal-officiel.gouv.fr` si vraiment besoin (rare pour
notre cible TPE/artisans).

## Rate limit

L'API opendatasoft tolère facilement 10 req/seconde. Pour nos volumes
(5-20 leads par run), aucun risque.

## Règles strictes

- ❌ JAMAIS marquer `company_active = false` sans annonce BODACC
  formelle (radiation/liquidation)
- ❌ JAMAIS skip cette vérif si tu as un SIREN — c'est rapide et
  gratuit
- ✅ Toujours stocker la dernière annonce dans `raw_payload.bodacc_check`
  pour audit
- ✅ Si en doute, `company_active = true` par défaut (mieux vaut un
  faux positif qu'un faux négatif sur un lead correct)
