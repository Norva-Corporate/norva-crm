---
name: prospection-scoring
description: Source de vérité unique du framework de scoring Norva. Score un prospect sur 4 axes équipondérés (Fit, Pain, Reach, Budget — 25 % chacun). Renvoie un score 0.0-1.0, un quality_score 0-100, et la décision SKIP/INSERT. Référencée par lead-intake-prompt.md, enrichissement-prompt.md, rescoring-deal-prompt.md.
---

# Skill — Framework scoring (source unique)

> Toute formule "en dur" dans un prompt agent est un bug — référencer
> ce fichier.

## Pondération : 25 % par axe

## Fit (25 %)

- 0.9-1.0 : artisan/commerce/libéral 0-9 salariés (tranches `00`-`03`)
- 0.7-0.9 : TPE 10-49 salariés (`11`, `12`)
- 0.4-0.7 : périphérique (secteur tangent)
- < 0.4 : hors cible (admin, > 5000 salariés)

## Pain (25 %)

MAX(`site_audit` qualitatif, `pagespeed_score`)

- 0.9-1.0 : pas de site
- 0.7-0.9 : site cassé OU PageSpeed < 30
- 0.5-0.7 : site obsolète (HTTP, mobile cassé) OU PageSpeed 30-69 OU 4+ drapeaux/7 mauvais
- 0.3-0.5 : PageSpeed 70-89, 2-3 drapeaux mauvais
- < 0.3 : site moderne PageSpeed 90+

## Reach (25 %) — formule additive, cap 1.0

| Signal | Contribution |
|---|---|
| Téléphone valide | +0.4 |
| Email `valid` | +0.4 |
| Email `risky` | +0.2 |
| Email `invalid` ou absent | 0 |
| Dirigeant identifié (first+last) | +0.2 |
| LinkedIn vérifié | +0.1 |

## Budget (25 %) — cap 1.0

**Niveau 1 (Pappers, si dispo)** :
- `pappers.ca_declared` > 100 k€ : +0.4 / 50-100 k€ : +0.25 / < 50 k€ : +0.1
- `pappers.capital_social` > 10 k€ : +0.15
- `pappers.effectif_reel` > 5 : +0.1
- Ancienneté > 3 ans : +0.1

**Niveau 2 (fallback Google Places, si pas de Pappers)** :
- Note ≥ 4.0 ET ≥ 30 avis : +0.5
- Note ≥ 4.0 ET 15-29 avis : +0.3
- Note ≥ 4.0 ET < 15 avis : +0.1
- Note < 4.0 ou aucune : 0

## Calcul final

```
score = (fit + pain + reach + budget) * 0.25
if score >= 0.65 → priority = "Oui" sinon "Non"
```

## quality_score (0-100, complétude des données)

| Critère | Points |
|---|---|
| `email_verified = 'valid'` | 30 |
| `email_verified = 'risky'` | 15 |
| `linkedin_verified = true` | 20 |
| `company_active = true` | 20 |
| Dirigeant identifié | 15 |
| Téléphone présent | 10 |
| Site audité | 5 |

Badge CRM : ≥80 🟢 / 40-79 🟡 / <40 🔴

## Seuils de décision (source unique)

| Condition | Action |
|---|---|
| `score < 0.40` | SKIP |
| `quality_score < 35` | SKIP |
| `company_active = false` | SKIP |
| Pas de tel ET `email = invalid` | SKIP |
| Dirigeant non identifié ET `email = unverified` | SKIP |
| Sinon | INSERT |

## Stockage `raw_payload`

```json
{
  "score": 0.78,
  "priority": "Oui",
  "score_breakdown": { "fit": 0.85, "pain": 0.95, "reach": 0.7, "budget": 0.6 },
  "quality_score": 88
}
```

## Exemple

**Coiffeur quartier sans site, 4.7/142 avis** : Fit 0.95 + Pain 0.95 +
Reach 1.0 (tel+email valid+dirigeant) + Budget 0.5 (note Google + avis)
= `0.85` → priority Oui.
