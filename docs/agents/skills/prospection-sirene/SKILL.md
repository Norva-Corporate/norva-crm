---
name: prospection-sirene
description: Use this skill as a strict fallback when `prospection-enrichment-gouv` (fuzzy search on company name) returns no match, OR when you need to validate a SIRET found in mentions légales / Pappers. Uses the official INSEE Sirene v3 API (free, unlimited after registration on api.insee.fr). Returns raw INSEE data : exact creation date, NAF code, validated address, legal form. Bearer token auth, token expires every 7 days (renewable). Skip silently if SIRENE_API_TOKEN absent.
---

# Skill — Vérification stricte via INSEE Sirene v3

## Quand utiliser

**Fallback strict** : appeler cette skill uniquement quand :

1. `prospection-enrichment-gouv` (fuzzy par nom) retourne 0 résultat ou
   un match flou (multiples entreprises au même nom, pas de match
   d'adresse claire)
2. OU tu as récupéré un **SIRET en mentions légales** (loi LCEN) et tu
   veux le valider contre la source officielle INSEE
3. OU tu as un SIREN/SIRET via Pappers et tu veux croiser avec la
   source officielle (rare mais utile)

**Skip si** :
- `SIRENE_API_TOKEN` absent dans l'env → la skill ne peut rien faire
- Tu as déjà un SIRET validé via `prospection-enrichment-gouv` qui a
  matché clairement (économise une requête)

## Pourquoi c'est utile

L'API gouv `recherche-entreprises.api.gouv.fr` est pratique mais
**fuzzy** — elle peut renvoyer plusieurs entreprises au même nom commercial
sans pouvoir trancher. Sirene v3 est la **source officielle INSEE** :

- Recherche par SIRET exact (14 chiffres) → 1 résultat ou 0
- Données brutes officielles (jamais "à peu près")
- Adresse validée par l'INSEE (utile pour cross-check Google Places)
- Code NAF brut (4 caractères + libellé) plus précis que le wording de
  l'API gouv

## Pré-requis

Variable d'environnement `SIRENE_API_TOKEN` (Bearer token).

**Obtention** : inscription gratuite sur `https://api.insee.fr` →
abonnement à l'API Sirene v3 (gratuit illimité) → génération d'un
token Bearer. **Durée 7 jours, à renouveler**.

⚠️ Le token expire silencieusement. Si tu reçois un 401, c'est
probablement ça — informe l'utilisateur de renouveler.

## Endpoint

`GET https://api.insee.fr/entreprises/sirene/V3/siret/{siret}`

Headers requis :
- `Authorization: Bearer <SIRENE_API_TOKEN>`
- `Accept: application/json`

Exemple via Bash :

    SIRET=55212022200013
    curl -H "Authorization: Bearer $SIRENE_API_TOKEN" \
         -H "Accept: application/json" \
         "https://api.insee.fr/entreprises/sirene/V3/siret/$SIRET"

## Recherche par SIREN (au lieu de SIRET)

Si tu n'as que le SIREN (9 chiffres) sans le SIRET du siège, utilise
le endpoint `siren/{siren}` qui renvoie les **établissements** :

    SIREN=552120222
    curl -H "Authorization: Bearer $SIRENE_API_TOKEN" \
         "https://api.insee.fr/entreprises/sirene/V3/siret?q=siren:$SIREN%20AND%20etablissementSiege:true"

→ filtre sur le siège (1 seul résultat).

## Champs utiles dans la réponse

```json
{
  "etablissement": {
    "siret": "55212022200013",
    "etablissementSiege": true,
    "dateCreationEtablissement": "1995-03-12",
    "uniteLegale": {
      "denominationUniteLegale": "...",
      "categorieJuridiqueUniteLegale": "5499",
      "activitePrincipaleUniteLegale": "96.02A",
      "nomenclatureActivitePrincipaleUniteLegale": "NAFRev2",
      "trancheEffectifsUniteLegale": "12",
      "dateCreationUniteLegale": "1995-03-12",
      "etatAdministratifUniteLegale": "A"
    },
    "adresseEtablissement": {
      "numeroVoieEtablissement": "12",
      "typeVoieEtablissement": "RUE",
      "libelleVoieEtablissement": "DE LA REPUBLIQUE",
      "codePostalEtablissement": "69006",
      "libelleCommuneEtablissement": "LYON"
    }
  }
}
```

## Mapping vers `raw_payload.sirene`

    UPDATE public.lead_imports
    SET verified_at = now(),
        raw_payload = raw_payload || jsonb_build_object(
          'sirene', jsonb_build_object(
            'checked_at', now()::text,
            'siret', '<siret>',
            'naf_brut', '<activitePrincipaleUniteLegale>',
            'date_creation', '<dateCreationEtablissement>',
            'tranche_effectif', '<trancheEffectifsUniteLegale>',
            'etat_administratif', '<A|F|C>',
            'categorie_juridique', '<categorieJuridiqueUniteLegale>',
            'adresse_validee', jsonb_build_object(
              'numero', '<numeroVoieEtablissement>',
              'type_voie', '<typeVoieEtablissement>',
              'libelle_voie', '<libelleVoieEtablissement>',
              'code_postal', '<codePostalEtablissement>',
              'commune', '<libelleCommuneEtablissement>'
            )
          )
        )
    WHERE id = '<lead_id>';

## Vérification de cohérence

Une fois Sirene appelé, compare :

- `adresse_validee.code_postal` vs adresse Google Places → doivent
  matcher. Si écart → flagger `raw_payload.warnings = ["adresse_divergente"]`
- `etat_administratif` :
  - `"A"` = Actif (OK)
  - `"F"` = Fermé (= entreprise éteinte → `company_active = false`,
    pas besoin d'attendre BODACC)
  - `"C"` = Cessé (idem `F`)

Si `etat_administratif != "A"` → SKIP l'insertion (cohérent avec
les seuils de `prospection-scoring`).

## Rate limit

API Sirene v3 limite à **30 req/seconde** (très permissif). Pour nos
volumes, jamais bloquant.

## Erreurs courantes

| Code HTTP | Cause | Action |
|---|---|---|
| 401 | Token expiré ou invalide | Informer l'utilisateur de renouveler le `SIRENE_API_TOKEN` (durée 7 jours) |
| 403 | API non abonnée sur ce token | Vérifier l'abonnement sur api.insee.fr |
| 404 | SIRET / SIREN inexistant | Données absentes côté INSEE — rare, peut indiquer un faux SIRET trouvé en mentions légales |
| 429 | Rate limit dépassé (30/s) | Attendre 1s et retry |

## Différence avec `prospection-enrichment-gouv`

| Aspect | `enrichment-gouv` | `sirene` |
|---|---|---|
| Type de recherche | Fuzzy par nom (`q=` + ville) | Strict par SIRET ou SIREN exact |
| Auth | Aucune | Bearer token (gratuit après inscription) |
| Donnée dirigeant | Oui (`dirigeants[]`) | Non (Sirene ne renvoie pas les personnes) |
| Adresse validée | Approximative | Officielle INSEE |
| Quand l'appeler | Toujours en premier | Fallback strict si fuzzy échoue |

**Conséquence** : Sirene **complète** mais ne **remplace pas**
`enrichment-gouv` pour le dirigeant. Toujours appeler `enrichment-gouv`
en primaire pour le dirigeant + secondaires.

## Règles strictes

- ❌ JAMAIS appeler Sirene en primaire — c'est un fallback strict
- ❌ JAMAIS dupliquer un appel si `sirene.checked_at < 30 jours` (les
  données INSEE bougent peu)
- ❌ JAMAIS utiliser Sirene pour identifier le dirigeant — l'API ne le
  retourne pas, c'est le rôle de `enrichment-gouv` ou des mentions
  légales
- ✅ Toujours stocker dans `raw_payload.sirene` (isolé des autres
  sources)
- ✅ Si `etat_administratif != "A"`, court-circuite BODACC : SKIP direct
