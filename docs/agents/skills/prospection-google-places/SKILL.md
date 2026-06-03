---
name: prospection-google-places
description: Use this skill when you need to find local French businesses (artisans, TPE, restaurants, shops, small startups) by activity and city. Calls the Google Places API Text Search v1 via Bash curl, with a Supabase-backed query cache, a hard daily cap, and place_id dedup against `lead_imports`. Returns structured business data (name, address, phone, website, rating, review count) ready to be mapped into Norva's `lead_imports` table.
---

# Skill — Discovery Google Places API

## Quand utiliser cette skill

Au démarrage de toute session de prospection, dès qu'un critère
`<activité> <ville>` est fourni.

## Pré-requis

- Variable d'environnement `GOOGLE_MAPS_API_KEY` chargée. Si absente,
  arrête immédiatement avec un message clair pour l'utilisateur.
- Accès `mcp__supabase__execute_sql` (chargé via `--mcp-config`). Si
  l'outil n'est pas trouvé, arrête : le cache + le cap quotidien
  passent obligatoirement par Supabase.

## Architecture coût (à lire avant de toucher)

L'API Places New facture **par requête Text Search**, au SKU
**Enterprise** (~$35/1k) dès qu'un de ces champs est demandé dans le
`FieldMask` : `internationalPhoneNumber`, `nationalPhoneNumber`,
`websiteUri`, `rating`, `userRatingCount`. On garde Enterprise — la
bascule vers Pro + Place Details à la demande est plus chère dès que
>1 lead sur 20 est gardé.

Trois leviers d'économie, empilés dans le workflow ci-dessous :

1. **Cache 30 jours par signature de query** → re-runs gratuits
2. **Cap quotidien dur** lu depuis `prospection_settings` →
   borne le pire cas
3. **Dedup `place_id` pré-enrichissement** → sauve les quotas
   downstream (Hunter, MailboxLayer, PageSpeed)

## Workflow OBLIGATOIRE (pour chaque query)

### Étape 0 — Normaliser la signature

    signature = lower(trim("<textQuery>"))   -- single-space, accents conservés

Exemple : `"  Coiffeur   Bourgoin "` → `"coiffeur bourgoin"`.

### Étape 1 — Cache hit ?

    SELECT results, result_count, cached_at
    FROM public.places_search_cache
    WHERE query_signature = '<signature>'
      AND region_code = 'FR'
      AND language_code = 'fr'
      AND cached_at > now() - interval '30 days';

- **Hit** → bump le compteur, log le run, **skip le curl** :

      UPDATE public.places_search_cache
         SET hit_count = hit_count + 1
       WHERE query_signature = '<signature>'
         AND region_code = 'FR' AND language_code = 'fr';

      INSERT INTO public.places_search_log
        (query_signature, region_code, cache_hit, result_count, new_place_ids)
      VALUES ('<signature>', 'FR', true, <result_count>, 0);
      -- new_place_ids = 0 ici, sera maj après dedup (étape 5)

  Passe directement à l'**Étape 5** avec les `results` cachés.

- **Miss** → continue à l'Étape 2.

### Étape 2 — Cap quotidien (uniquement si miss)

    SELECT
      (SELECT value::int FROM public.prospection_settings
        WHERE key = 'places_max_searches_per_day') AS cap,
      (SELECT count(*) FROM public.places_search_log
        WHERE cache_hit = false
          AND run_at::date = current_date) AS used_today;

Si `used_today >= cap` → **STOP immédiat** avec ce message :

> Cap quotidien Places atteint (`<used_today>/<cap>`). Reprise demain,
> ou augmente `prospection_settings.places_max_searches_per_day` si
> tu veux pousser plus loin aujourd'hui.

N'enchaîne **pas** sur l'enrichissement des leads déjà obtenus dans
la même session — ferme proprement avec un récap des queries jouées.

### Étape 3 — Appel curl Places (FieldMask Enterprise inchangé)

    curl -X POST 'https://places.googleapis.com/v1/places:searchText' \
      -H 'Content-Type: application/json' \
      -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
      -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.businessStatus,places.googleMapsUri' \
      -d '{
        "textQuery": "<activité> <ville>",
        "languageCode": "fr",
        "regionCode": "FR",
        "pageSize": 20
      }'

### Étape 4 — Persister le cache

    INSERT INTO public.places_search_cache
      (query_signature, region_code, language_code, results, result_count, cached_at, hit_count)
    VALUES
      ('<signature>', 'FR', 'fr', '<json places[]>'::jsonb, <N>, now(), 0)
    ON CONFLICT (query_signature, region_code, language_code) DO UPDATE
      SET results      = excluded.results,
          result_count = excluded.result_count,
          cached_at    = now();

Stocke uniquement le tableau `places[]` retourné par l'API (pas
l'enveloppe complète), c'est suffisant pour rejouer la query.

### Étape 5 — Dedup `place_id` pré-enrichissement (OBLIGATOIRE)

Avant de passer les résultats aux skills downstream
(`prospection-enrichment-gouv`, `prospection-bodacc-check`,
`prospection-email-discovery`, etc.), filtre les `place_id` déjà
importés :

    SELECT external_id
    FROM public.lead_imports
    WHERE source = 'claude-lead-intake'
      AND external_id = ANY(ARRAY['places/ChIJ...', 'places/ChIJ...']::text[]);

Skippe ces leads (ne les enrichis pas). Mentionne-les dans le récap
final en "doublon avant enrichissement". Ça **n'économise pas** le
coût Places (déjà payé à l'étape 3) mais ça sauve les quotas Hunter
(25/mois), MailboxLayer (100/mois) et PageSpeed.

### Étape 6 — Logger le run

    INSERT INTO public.places_search_log
      (query_signature, region_code, cache_hit, result_count, new_place_ids)
    VALUES
      ('<signature>', 'FR', false, <result_count>, <count après dedup étape 5>);

## Mapping vers Norva

| Champ API Places | Destination Norva |
|------------------|-------------------|
| `id` | `external_id` (format `places/ChIJ...`, stable) + `raw_payload.place_id` |
| `displayName.text` | `company_name` |
| `formattedAddress` | `raw_payload.address` |
| `nationalPhoneNumber` | `phone` (préférer cette forme) |
| `internationalPhoneNumber` | `phone` (fallback) |
| `websiteUri` | `raw_payload.website` (peut être null = OK) |
| `googleMapsUri` | `raw_payload.google_maps_url` (URL canonique de la fiche Google Maps) |
| `rating` | `raw_payload.google_rating` |
| `userRatingCount` | `raw_payload.review_count` |
| `types` | indice pour `raw_payload.sector` |
| `businessStatus` | filtre : ne garder que `OPERATIONAL` |

## Pagination

`pageSize` max = 20 par requête. Pour plus de volume, **multiplie les
queries narrow distinctes** (`plombier bourgoin`, `électricien
bourgoin`, `menuisier bourgoin`) plutôt que de paginer. Évite les
queries broad qui se chevauchent (`artisan bourgoin` recouvre tout ce
qui précède) — elles consomment du cap pour rien.

## Erreurs courantes

- **403 PERMISSION_DENIED** : la Places API n'est pas activée pour
  cette clé, ou la clé est restreinte. Demande à l'utilisateur de
  vérifier la console GCP.
- **429 RESOURCE_EXHAUSTED** : quota dépassé côté Google. Arrête la
  session — distinct du cap interne (étape 2).
- **400 INVALID_ARGUMENT** : payload mal formé. Vérifie le JSON du
  body et les guillemets.

## Bonnes pratiques

- Toujours `languageCode=fr` et `regionCode=FR` pour des résultats
  pertinents en France.
- Les `types` Google (ex. `hair_care`, `restaurant`, `bakery`) sont
  un excellent indice pour le `sector` du vocabulaire Norva.
- **Queries narrow > queries broad** (cf. Pagination).
- Avant de relancer une zone, regarde le journal :

      SELECT query_signature, run_at, cache_hit, new_place_ids
      FROM public.places_search_log
      WHERE query_signature ILIKE '%<ville>%'
      ORDER BY run_at DESC LIMIT 20;

  Si une query rend `new_place_ids = 0` deux runs de suite, la zone
  est saturée — passe à un autre angle.
