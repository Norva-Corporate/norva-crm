---
name: prospection-pappers
description: Use this skill to enrich a French prospect's Budget signal via the Pappers free API (100 requests/day, free tier). Returns capital social, declared turnover (chiffre d'affaires if published), precise headcount band, secondary directors, founding date and activity domain. Used by Lead Intake and Enrichissement to feed the Budget axis of the prospection-scoring skill with hard financial data, much better than the Google Places review count fallback. Requires PAPPERS_API_KEY env var (free tier on pappers.fr — 100 req/day). Skip silently if key absent or quota exhausted.
---

# Skill — Enrichissement Pappers (signal Budget)

## Quand utiliser

Systématiquement après l'enrichissement gouv si tu as un **SIREN** et
que `PAPPERS_API_KEY` est présent dans l'env.

**Skip si** :
- `PAPPERS_API_KEY` absent → continue sans, fallback Google Places
  pour le Budget dans `prospection-scoring`
- `raw_payload.pappers.checked_at` existe et < 90 jours → données encore
  valables, économise une requête
- Pas de SIREN → la skill ne peut rien faire

## Pourquoi c'est utile

L'API gouv `recherche-entreprises` donne le dirigeant + effectif tranche
+ NAF, mais **pas** :

- Le **chiffre d'affaires** déclaré (signal Budget fort si publié)
- Le **capital social** (signal Budget fort)
- Les **dirigeants secondaires** (pour identifier le bon décideur)
- L'**effectif réel** déclaré (plus précis que les tranches)
- La **date exacte d'immatriculation** (ancienneté = stabilité)

Pappers complète ces signaux. Pour notre cible TPE, beaucoup
d'entreprises ne publient pas leur CA — mais le capital social et
l'effectif réel sont quasi toujours là.

## Pré-requis

Variable d'environnement `PAPPERS_API_KEY` (obtention gratuite sur
`pappers.fr` après création de compte). Limite : **100 requêtes par jour**.

## Endpoint

`GET https://api.pappers.fr/v2/entreprise`

Paramètres clés :
- `api_token` : ta clé
- `siren` : SIREN à 9 chiffres (récupéré de `prospection-enrichment-gouv`)

Exemple via Bash :

    SIREN=552120222
    curl "https://api.pappers.fr/v2/entreprise?api_token=$PAPPERS_API_KEY&siren=$SIREN"

## Champs utiles dans la réponse

```json
{
  "siren": "552120222",
  "denomination": "...",
  "capital": 50000,
  "capital_formate": "50 000,00 €",
  "date_creation": "1995-03-12",
  "tranche_effectif_salarie": "12",
  "effectif_min": 20,
  "effectif_max": 49,
  "chiffre_affaires": 1250000,
  "chiffre_affaires_par_annee": [
    { "annee": 2024, "chiffre_affaires": 1250000 },
    { "annee": 2023, "chiffre_affaires": 1100000 }
  ],
  "domaine_activite": "Coiffure",
  "categorie_juridique": "5499",
  "dirigeants": [
    { "nom": "...", "prenoms": "...", "qualite": "GERANT", "actuel": true },
    { "nom": "...", "prenoms": "...", "qualite": "CO-GERANT", "actuel": true }
  ]
}
```

## Mapping vers `raw_payload.pappers`

    UPDATE public.lead_imports
    SET verified_at = now(),
        raw_payload = raw_payload || jsonb_build_object(
          'pappers', jsonb_build_object(
            'checked_at', now()::text,
            'siren', '<SIREN>',
            'capital_social', <capital ou null>,
            'ca_declared', <chiffre_affaires ou null>,
            'ca_history', <chiffre_affaires_par_annee ou null>,
            'effectif_reel', <effectif_max ou null>,
            'date_creation', '<date_creation>',
            'domaine_activite', '<domaine_activite>',
            'dirigeants_secondaires', <array des co-gérants actuels hors dirigeant principal>
          )
        )
    WHERE id = '<lead_id>';

## Contribution au scoring Budget

Voir [`prospection-scoring/SKILL.md`](../prospection-scoring/SKILL.md)
section *Budget (25 %)* — Pappers fournit les signaux de **niveau 1**
qui priment sur la note Google (niveau 2).

Récap rapide :

| Signal Pappers | Contribution Budget |
|---|---|
| `ca_declared` > 100 k€ | +0.4 |
| `ca_declared` 50-100 k€ | +0.25 |
| `ca_declared` < 50 k€ | +0.1 |
| `capital_social` > 10 k€ | +0.15 |
| `effectif_reel` > 5 | +0.1 |
| Ancienneté (`date_creation` > 3 ans) | +0.1 |

Cap à 1.0.

## Cas spéciaux

### Auto-entrepreneur / micro-entreprise

`capital` est null (pas de capital social pour micro-entreprise).
`chiffre_affaires` rarement publié. Tu peux malgré tout récupérer la
`date_creation`, l'`effectif_min/max`, et les dirigeants → contribution
Budget modeste mais réelle.

### Société sans comptes publiés

`chiffre_affaires` absent (toute société peut différer la publication).
Pas grave : `capital_social` + `effectif_reel` + ancienneté suffisent
pour un signal Budget partiel.

### Quota épuisé (100/jour)

Pappers retourne 429. Skip cette skill, `raw_payload.pappers` non
modifié. Pas d'erreur fatale — le scoring fallback sur Google Places.

### Dirigeant principal vs secondaires

Si l'API gouv a identifié un dirigeant principal, le stocker en
`first_name/last_name`. Les autres (co-gérants, présidents
secondaires) vont dans `raw_payload.pappers.dirigeants_secondaires`
pour information — l'utilisateur pourra choisir un autre interlocuteur
si pertinent.

## Rate limit

100 req/jour gratuites. Pour notre volume (10-20 leads par session Lead
Intake), c'est largement suffisant. Si tu approches du plafond, tracker
dans `raw_payload.pappers.quota_state` (ex `{ "used_today": 87 }`).

## Erreurs courantes

| Code HTTP | Cause | Action |
|---|---|---|
| 401 | `PAPPERS_API_KEY` invalide | Skip cette skill, message clair pour l'utilisateur |
| 404 | SIREN inexistant chez Pappers | Skip silencieusement (rare mais arrive pour des associations / org publiques) |
| 429 | Quota dépassé | Skip, tracker dans `raw_payload.pappers.quota_state` |
| 5xx | Pappers en panne | Skip, retry plus tard |

## Règles strictes

- ❌ JAMAIS appeler Pappers sans SIREN — c'est le filtre clé
- ❌ JAMAIS dupliquer un appel si `pappers.checked_at < 90 jours`
- ❌ JAMAIS écrire `capital_social`, `ca_declared`, `effectif_reel` ailleurs
  que dans `raw_payload.pappers.*` — pas de pollution des colonnes du lead
- ✅ Si Pappers indispo, le scoring continue avec fallback Google Places
- ✅ Pappers vit dans `raw_payload.pappers`, isolé des données gouv
  (qui restent dans `raw_payload.siret`, `raw_payload.siren`, etc.)
