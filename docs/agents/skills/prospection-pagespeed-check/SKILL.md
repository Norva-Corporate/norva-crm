---
name: prospection-pagespeed-check
description: Use this skill to score a prospect's website performance using Google PageSpeed Insights API (free, 25 000 requests/day). Returns a 0-100 mobile performance score and key Core Web Vitals signals (LCP, CLS, INP). A low score is a strong Pain signal — perfect ammunition for a sales pitch to a TPE/artisan who needs their site rebuilt or optimized.
---

# Skill — Audit performance site (Google PageSpeed Insights)

## Quand utiliser

Chaque fois qu'un prospect a un `websiteUri` non-null. Complète
`prospection-site-audit` qui regarde les drapeaux qualitatifs (HTTPS,
mobile, booking, tarifs…) avec un **score objectif** de performance.

**Skip si pas de site** — Pain est déjà au max sans ça.

## Pourquoi ça aide

Pour un TPE/artisan, un site lent (LCP > 4s sur mobile) :

- Tue 50%+ du trafic mobile (Google le sait, Google déclasse)
- Décourage les leads chauds qui abandonnent avant le formulaire
- Argument béton en cold call : "Votre site charge en 6 secondes,
  vous perdez X% de clients" — c'est mesurable, indiscutable

C'est un signal **Pain** plus crédible que "ton site a l'air vieux".

## API utilisée

**Endpoint gratuit** (25 000 req/jour avec une clé API Google Cloud
gratuite, ou ~1 req/sec sans clé) :

    https://www.googleapis.com/pagespeedonline/v5/runPagespeed

Paramètres :

- `url` — l'URL à auditer (homepage du prospect)
- `strategy=mobile` — **toujours mobile** (60%+ du trafic FR aujourd'hui)
- `category=performance` — on n'a besoin que de perf (skip SEO/A11y)
- `key=<GOOGLE_PAGESPEED_KEY>` (optionnel, augmente la limite)

Exemple via Bash :

    URL="https://salon-acme.fr"
    curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$URL&strategy=mobile&category=performance${GOOGLE_PAGESPEED_KEY:+&key=$GOOGLE_PAGESPEED_KEY}"

## Réponse utile

Lourde (>1 MB), tu ne veux que ces champs :

- `lighthouseResult.categories.performance.score` (float 0-1)
  → multiplie par 100 pour avoir 0-100
- `lighthouseResult.audits.largest-contentful-paint.numericValue` (ms)
- `lighthouseResult.audits.cumulative-layout-shift.numericValue`
- `lighthouseResult.audits.interaction-to-next-paint.numericValue` (ms)
- `lighthouseResult.audits.total-byte-weight.numericValue` (octets)

Extraction propre via `jq` :

    SCORE=$(echo "$RESPONSE" | jq '.lighthouseResult.categories.performance.score * 100 | floor')
    LCP=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["largest-contentful-paint"].numericValue')
    CLS=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["cumulative-layout-shift"].numericValue')

## Interprétation du score (Pain mapping)

| PageSpeed Score | Lecture | Contribution au Pain |
|---|---|---|
| 0-29 | Site catastrophique, plante sur mobile | Pain += 0.30 |
| 30-49 | Site très lent, expérience cassée | Pain += 0.20 |
| 50-69 | Site médiocre, mérite refonte | Pain += 0.10 |
| 70-89 | Correct, marges d'optimisation | Pain += 0.0 (neutre) |
| 90-100 | Excellent, pas d'argument perf | Pain -= 0.05 (légèrement négatif) |

Combine avec `prospection-site-audit` :

- Pain final = max(audit_qualitatif, audit_pagespeed)
- Si les deux convergent (audit "obsolète" + PageSpeed 25) → Pain
  ultra fort, lead prioritaire

## Output — UPDATE à appliquer

    UPDATE public.lead_imports
    SET pagespeed_score = <score 0-100>,
        verified_at = now(),
        raw_payload = raw_payload || jsonb_build_object(
          'pagespeed', jsonb_build_object(
            'score', <score>,
            'lcp_ms', <LCP>,
            'cls', <CLS>,
            'inp_ms', <INP>,
            'page_weight_kb', <weight / 1024>,
            'checked_at', now()::text,
            'strategy', 'mobile'
          )
        )
    WHERE id = '<lead_id>';

## Erreurs courantes

| Erreur HTTP | Cause | Action |
|---|---|---|
| 429 | Quota dépassé (rare) | Skip cette skill, `pagespeed_score = NULL` |
| 400 | URL malformée | Vérifier que `https://` est présent |
| 500 / 504 | PageSpeed timeout (site trop lent !) | Score = 0 (signal très fort de Pain) + note dans raw_payload |
| Réponse vide | Site bloque les bots | Skip, `pagespeed_score = NULL` |

## Économiser le quota

- 1 audit par site → ne pas re-auditer si `pagespeed_score IS NOT NULL`
  et que `verified_at < 60 jours`
- Mobile uniquement (skip desktop, double le quota disponible)

## Règles strictes

- ❌ JAMAIS auditer en `strategy=desktop` (perte de quota, le mobile
  est ce qui compte)
- ❌ JAMAIS inventer un score si l'API échoue (`pagespeed_score = NULL`)
- ✅ Toujours mobile-first (60%+ du trafic FR)
- ✅ Stocker les Core Web Vitals dans raw_payload pour pitch commercial
  ("votre LCP est à 5.8s, l'objectif Google est < 2.5s")
- ✅ Re-auditer après 60 jours si on reprend contact
