---
name: prospection-enrichment-gouv
description: Use this skill to enrich a French prospect with verified legal data from the official government open API (recherche-entreprises.api.gouv.fr). Returns SIREN, SIRET, dirigeant first/last name + role, NAF code, effectif, founding date — all 100% free, no auth required, official data.gouv.fr source. Essential for getting accurate gérant names to personalize outreach to French SMBs.
---

# Skill — Enrichissement via API gouvernementale

## Quand utiliser

**Source primaire** pour identifier dirigeant + SIREN d'un prospect FR
après le discovery Google Places. Recherche **fuzzy** par nom + ville
— pratique mais peut renvoyer plusieurs résultats au même nom.

Récupère :

- **Prénom + nom du dirigeant** (gérant, président, etc.) — clé pour
  personnaliser l'approche commerciale
- **SIREN / SIRET** (identification légale unique)
- **Code NAF / activité principale** (officiel)
- **Tranche d'effectif** salarié déclaré
- **Date de création** (ancienneté = signal de stabilité)

**100% gratuit, pas d'auth, source officielle data.gouv.fr.**

### Chaîne complète d'enrichissement officiel

Cette skill est la **première étape** d'une chaîne qui peut continuer
si besoin :

1. **`prospection-enrichment-gouv`** (cette skill) — fuzzy par nom + ville
2. **[`prospection-sirene`](../prospection-sirene/SKILL.md)** — fallback
   strict par SIRET via INSEE Sirene v3 (si l'étape 1 ne matche pas
   clairement, ou pour valider un SIRET trouvé en mentions légales)
3. **[`prospection-pappers`](../prospection-pappers/SKILL.md)** —
   complément Budget si `PAPPERS_API_KEY` présent (CA déclaré, capital,
   effectif réel, dirigeants secondaires)

Les trois skills écrivent dans des sous-clés isolées de `raw_payload`
(`raw_payload.sirene`, `raw_payload.pappers`) pour ne pas se marcher
dessus. Cette skill-ci écrit dans les colonnes du lead
(`first_name`, `last_name`, `role`, `company_name`) et dans les clés
racine de `raw_payload` (`siret`, `siren`, `headcount`, `date_creation`).

## Endpoint

`GET https://recherche-entreprises.api.gouv.fr/search`

Paramètres clés :

- `q` : nom de l'entreprise (+ ville si ambiguïté)
- `code_postal` : optionnel, pour filtrer
- `departement` : optionnel
- `per_page` : 5 suffit pour valider un match

Exemple via Bash :

    curl 'https://recherche-entreprises.api.gouv.fr/search?q=salon%20marie%20coiffure&code_postal=69006&per_page=5'

## Réponse utile (champs à exploiter)

Pour chaque résultat dans `results[]` :

- `siren` — 9 chiffres
- `siege.siret` — 14 chiffres
- `siege.adresse`, `siege.code_postal`, `siege.libelle_commune`
- `nom_complet` — raison sociale
- `nom_raison_sociale`
- `dirigeants[]` — array avec :
  - `nom` — nom de famille
  - `prenoms` — prénom(s) (parfois multiples)
  - `qualite` — fonction (ex `GERANT`, `PRESIDENT`, `DIRECTEUR GENERAL`)
  - `date_de_naissance` — mois/année (ex `1985-03`)
  - `type_dirigeant` — `personne physique` ou `personne morale`
- `activite_principale` — libellé NAF
- `tranche_effectif_salarie` — code (mapping ci-dessous)
- `date_creation` — YYYY-MM-DD

## Mapping vers les champs Norva

| API gouv | Champ Norva |
|----------|-------------|
| `dirigeants[0].prenoms` (1er mot) | `first_name` |
| `dirigeants[0].nom` | `last_name` |
| `dirigeants[0].qualite` | `role` (mapper sur le vocabulaire) |
| `siren` | `raw_payload.siren` |
| `siege.siret` | `raw_payload.siret` |
| `tranche_effectif_salarie` | `raw_payload.headcount` (label) |
| `date_creation` | `raw_payload.date_creation` |
| `activite_principale` | indice pour `raw_payload.sector` |
| `nom_complet` | comparer à `company_name` Google pour validation |

## Mapping `qualite` → vocabulaire Norva `role`

| API gouv | Norva |
|----------|-------|
| `GERANT` | Gérant |
| `PRESIDENT` | Président |
| `DIRECTEUR GENERAL` | Directeur |
| `PRESIDENT DU CONSEIL D'ADMINISTRATION` | Président |
| `ASSOCIE GERANT` | Gérant |
| `ENTREPRENEUR INDIVIDUEL` | Indépendant |
| Autre | Dirigeant |

Si plusieurs dirigeants : prends celui avec `qualite=GERANT` ou
`PRESIDENT` en priorité, sinon le premier.

## Tranches d'effectif (mapping label lisible)

| Code | Label `headcount` |
|------|-------------------|
| "" / "NN" / null | "Non renseigné" |
| "00" | "0 salarié (gérant seul)" |
| "01" | "1-2 salariés" |
| "02" | "3-5 salariés" |
| "03" | "6-9 salariés" |
| "11" | "10-19 salariés" |
| "12" | "20-49 salariés" |
| "21" | "50-99 salariés" |
| "22" | "100-199 salariés" |
| "31" | "200-249 salariés" |
| "32" | "250-499 salariés" |
| "41" | "500-999 salariés" |
| "51" | "1000-1999 salariés" |
| "52" | "2000-4999 salariés" |
| "53" | "5000-9999 salariés" |
| "54" | "10000+ salariés" |

## Anti-mismatch (validation)

L'API renvoie souvent plusieurs entreprises au même nom. Pour valider
qu'on a la bonne :

1. Compare `siege.adresse + siege.code_postal` à l'adresse Google
   Places (tolérance : même code postal + nom de rue similaire)
2. Si match clair (adresse identique ou code postal identique avec
   nom de rue très proche) → on prend les données
3. Si match flou (juste le nom matche) → utilise SEULEMENT le SIREN
   et le secteur, **mets NULL pour first_name/last_name**, et ajoute
   dans `raw_payload.notes` : "Dirigeant non confirmé (multiple
   matches API gouv, pas de match d'adresse exact)"
4. Si aucun match → skip l'enrichissement gouv, garde uniquement les
   données Google Places

## Limites

- **Rate limit** : 7 req/seconde (très permissif, jamais bloquant
  pour notre usage)
- Pas de retour si l'entreprise n'est pas immatriculée (associations,
  micro non déclarées). Pas grave, on continue avec les infos
  Google Places.
- Les dirigeants `personne morale` (= société qui dirige une autre
  société) ne donnent pas de prénom/nom utiles → mets NULL.
- **Fuzzy par nom** : peut renvoyer plusieurs entreprises au même nom
  commercial. Si match flou → bascule sur
  [`prospection-sirene`](../prospection-sirene/SKILL.md) en fallback
  strict (par SIRET).

## Bonnes pratiques

- Toujours encoder l'URL avec %20 pour les espaces
- Si nom commercial très commun (`Le Salon`, `Pizza Bar`...), AJOUTE
  toujours le code postal pour limiter les faux matches
- Si la réponse API est vide ET que tu as un site web avec
  /mentions-legales → le SIRET est dedans (loi française), tente cette
  source avant d'abandonner
