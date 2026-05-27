---
name: prospection-pagespeed-check
description: Score a prospect's website performance via Google PageSpeed Insights (free, 25k req/day). Returns 0-100 mobile score + Core Web Vitals. Low score is a strong Pain signal.
---

# Skill — Audit perf site (Google PageSpeed)

## Quand utiliser

Site présent (`websiteUri` non-null). Skip si pas de site (Pain = max
sans ça).

## API (gratuit)

```
https://www.googleapis.com/pagespeedonline/v5/runPagespeed
```

Params : `url`, `strategy=mobile`, `category=performance`,
`key=<GOOGLE_PAGESPEED_KEY>` (optionnel — augmente quota à 25 000/jour).

```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$URL&strategy=mobile&category=performance${GOOGLE_PAGESPEED_KEY:+&key=$GOOGLE_PAGESPEED_KEY}"
```

## Extraction (via jq)

```bash
SCORE=$(echo "$RESPONSE" | jq '.lighthouseResult.categories.performance.score * 100 | floor')
LCP=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["largest-contentful-paint"].numericValue')
CLS=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["cumulative-layout-shift"].numericValue')
INP=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["interaction-to-next-paint"].numericValue')
```

## Mapping score → Pain

| Score | Lecture | Contribution Pain |
|---|---|---|
| 0-29 | Catastrophique | +0.30 |
| 30-49 | Très lent | +0.20 |
| 50-69 | Médiocre | +0.10 |
| 70-89 | Correct | 0 |
| 90-100 | Excellent | -0.05 |

Pain final = max(audit_qualitatif `site_audit`, mapping PageSpeed).

## Output

```sql
UPDATE public.lead_imports
SET pagespeed_score = <score>,
    verified_at = now(),
    raw_payload = raw_payload || jsonb_build_object(
      'pagespeed', jsonb_build_object(
        'score', <score>,
        'lcp_ms', <LCP>,
        'cls', <CLS>,
        'inp_ms', <INP>,
        'checked_at', now()::text,
        'strategy', 'mobile'
      )
    )
WHERE id = '<lead_id>';
```

## Erreurs

| Code | Action |
|---|---|
| 429 (quota) | Skip, `pagespeed_score = NULL` |
| 400 (URL) | Vérifier `https://` |
| 500/504 (timeout site) | Score = 0 (signal fort Pain) |
| Réponse vide | Skip, `pagespeed_score = NULL` |

## Règles strictes

- ❌ JAMAIS `strategy=desktop` (perte quota, mobile = 60%+ trafic FR)
- ❌ JAMAIS inventer score si API échoue (NULL)
- ✅ Mobile-only
- ✅ Re-auditer après 60j si reprise de contact
- ✅ Ne pas re-auditer si `pagespeed_score IS NOT NULL` et `verified_at < 60j`
