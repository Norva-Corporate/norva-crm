---
name: prospection-google-places
description: Use this skill when you need to find local French businesses (artisans, TPE, restaurants, shops, small startups) by activity and city. Calls the Google Places API Text Search v1 via Bash curl and returns structured business data (name, address, phone, website, rating, review count) ready to be mapped into Norva's lead_imports table.
---

# Skill — Discovery Google Places API

## Quand utiliser cette skill

Au démarrage de toute session de prospection, dès qu'un critère
"<activité> <ville>" est fourni.

## Pré-requis

Variable d'environnement `GOOGLE_MAPS_API_KEY` chargée. Si absente,
arrête immédiatement avec un message clair pour l'utilisateur.

## Appel API

Utilise l'outil Bash :

    curl -X POST 'https://places.googleapis.com/v1/places:searchText' \
      -H 'Content-Type: application/json' \
      -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
      -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.businessStatus' \
      -d '{
        "textQuery": "<activité> <ville>",
        "languageCode": "fr",
        "regionCode": "FR",
        "pageSize": 20
      }'

## Mapping vers Norva

| Champ API Places | Destination Norva |
|------------------|-------------------|
| `id` | `external_id` (format `places/ChIJ...`, stable) |
| `displayName.text` | `company_name` |
| `formattedAddress` | `raw_payload.address` |
| `nationalPhoneNumber` | `phone` (préférer cette forme) |
| `internationalPhoneNumber` | `phone` (fallback) |
| `websiteUri` | `raw_payload.website` (peut être null = OK) |
| `rating` | `raw_payload.google_rating` |
| `userRatingCount` | `raw_payload.review_count` |
| `types` | indice pour `raw_payload.sector` |
| `businessStatus` | filtre : ne garder que `OPERATIONAL` |

## Pagination

`pageSize` max = 20 par requête. Pour plus de volume, multiplie les
requêtes avec des termes différents (`coiffeur paris 11`,
`coiffeur paris 12`, etc.) plutôt que de paginer.

## Erreurs courantes

- **403 PERMISSION_DENIED** : la Places API n'est pas activée pour
  cette clé, ou la clé est restreinte. Demande à l'utilisateur de
  vérifier la console GCP.
- **429 RESOURCE_EXHAUSTED** : quota dépassé. Arrête la session.
- **400 INVALID_ARGUMENT** : payload mal formé. Vérifie le JSON du
  body et les guillemets.

## Bonnes pratiques

- Toujours `languageCode=fr` et `regionCode=FR` pour des résultats
  pertinents en France.
- Les `types` Google (ex. `hair_care`, `restaurant`, `bakery`) sont
  un excellent indice pour le `sector` du vocabulaire Norva.
