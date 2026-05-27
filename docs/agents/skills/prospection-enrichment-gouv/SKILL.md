---
name: prospection-enrichment-gouv
description: Enrich a French prospect with verified legal data from recherche-entreprises.api.gouv.fr. Returns SIREN, SIRET, dirigeant first/last name + role, NAF code, effectif, founding date. Free, no auth, official data.gouv.fr. Fuzzy search by name + city.
---

# Skill — Enrichissement API gouv

## Quand utiliser

Systématiquement après le discovery Google Places, source primaire pour
dirigeant + SIREN.

> **Chaîne complète** (sur Agent Enrichissement, pas Lead Intake) :
> cette skill (fuzzy par nom) → `prospection-sirene` (fallback strict
> par SIRET) → `prospection-pappers` (signaux Budget).

## Endpoint (gratuit, sans auth)

```
GET https://recherche-entreprises.api.gouv.fr/search
```

Params : `q` (nom + ville), `code_postal`, `per_page=5`.

```bash
curl 'https://recherche-entreprises.api.gouv.fr/search?q=salon%20marie%20coiffure&code_postal=69006&per_page=5'
```

## Champs utiles dans `results[]`

- `siren` (9 chiffres) / `siege.siret` (14)
- `siege.adresse`, `siege.code_postal`, `siege.libelle_commune`
- `nom_complet`, `nom_raison_sociale`
- `dirigeants[]` : `nom`, `prenoms`, `qualite`, `type_dirigeant`
- `activite_principale`, `tranche_effectif_salarie`, `date_creation`

## Mapping Norva

| API gouv | Norva |
|---|---|
| `dirigeants[0].prenoms` (1er mot) | `first_name` |
| `dirigeants[0].nom` | `last_name` |
| `dirigeants[0].qualite` | `role` (mappé ci-dessous) |
| `siren` | `raw_payload.siren` |
| `siege.siret` | `raw_payload.siret` |
| `tranche_effectif_salarie` | `raw_payload.headcount` (label) |
| `date_creation` | `raw_payload.date_creation` |
| `activite_principale` | indice `raw_payload.sector` |

## Mapping `qualite` → `role`

| API gouv | Norva |
|---|---|
| `GERANT`, `ASSOCIE GERANT` | Gérant |
| `PRESIDENT`, `PRESIDENT DU CONSEIL...` | Président |
| `DIRECTEUR GENERAL` | Directeur |
| `ENTREPRENEUR INDIVIDUEL` | Indépendant |
| Autre | Dirigeant |

Si plusieurs dirigeants : priorité `GERANT` ou `PRESIDENT`, sinon
premier de la liste.

## Tranches d'effectif

| Code | Label |
|---|---|
| `""`, `"NN"`, null | "Non renseigné" |
| `00` | "0 salarié" |
| `01` | "1-2 salariés" |
| `02` | "3-5 salariés" |
| `03` | "6-9 salariés" |
| `11` | "10-19 salariés" |
| `12` | "20-49 salariés" |
| `21`+ | "50+ salariés" (hors cible TPE) |

## Anti-mismatch

L'API renvoie souvent plusieurs entreprises au même nom. Validation :

1. Compare `siege.adresse + code_postal` à Google Places — match → OK
2. Match flou (juste nom) → SIREN OK, **NULL pour first_name/last_name**,
   note `raw_payload.notes = "Dirigeant non confirmé (multiple matches)"`
3. Aucun match → skip enrichment, garde données Google Places seules

## Limites

- Rate limit 7 req/s (jamais bloquant)
- Pas de retour pour associations, micro non déclarées
- Dirigeants `personne morale` → NULL prénom/nom
- Fuzzy → fallback Sirene v3 (par SIRET exact) via Agent Enrichissement

## Bonnes pratiques

- Encoder URL avec `%20`
- Nom commun ("Le Salon", "Pizza Bar") → ajouter code postal pour limiter faux matches
- Si réponse vide ET site avec `/mentions-legales` → SIRET souvent
  dedans (loi LCEN), tenter cette source
