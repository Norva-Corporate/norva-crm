---
name: prospection-scoring
description: Source de vérité unique du framework de scoring Norva. Score un prospect sur 4 axes équipondérés (Fit, Pain, Reach, Budget — 25 % chacun) et applique les seuils de décision d'insertion. Renvoie un score final (0.0-1.0), un quality_score (0-100), un priority flag (≥ 0.65), un breakdown par axe et la décision SKIP/INSERT. Référencée par lead-intake-prompt.md, enrichissement-prompt.md et rescoring-deal-prompt.md — toute autre source n'est plus authoritative.
---

# Skill — Framework de scoring (source unique)

> **Source de vérité unique** du scoring. `lead-intake-prompt.md`,
> `enrichissement-prompt.md` et `rescoring-deal-prompt.md` y renvoient
> pour la formule et les seuils. Toute formule "en dur" dans un prompt
> est un bug — corrige-le et renvoie ici.

## Pondération

| Axe | Pondération | Justification |
|-----|-------------|---------------|
| Fit | 25 % | Cible métier / géographique / taille (TPE 0-49 salariés FR) |
| Pain | 25 % | Faiblesse digitale = opportunité commerciale |
| Reach | 25 % | Faisabilité du contact (tel, email, dirigeant, LinkedIn) |
| Budget | 25 % | Capacité à payer la prestation |

## Comment scorer chaque axe (0.0 à 1.0)

### Fit (25 %)

Cible : artisan, commerce local, profession libérale solo/petite équipe,
petite entreprise de services B2B locale (France).

- **0.9 - 1.0** : artisan / commerce / pro libéral 0-9 salariés
  (tranches Pappers `00`, `01`, `02`, `03`) — cœur de cible
- **0.7 - 0.9** : TPE 10-49 salariés (tranches `11`, `12`) ou secteur
  parfaitement compatible (Fit neutre vs. cœur de cible)
- **0.4 - 0.7** : secteur ou taille périphérique (PME 50+ salariés
  tranche `21`, secteur tangent)
- **< 0.4** : hors cible totale (administration publique, multinationale
  > 5000 salariés, secteur incompatible)

### Pain (25 %)

Signaux observables : `site_audit` (qualitatif) + `pagespeed_score`
(perf mobile). Prendre le MAX des deux.

- **0.9 - 1.0** : aucun site web (best case)
- **0.7 - 0.9** : site cassé (404/5xx) OU PageSpeed < 30
- **0.5 - 0.7** : site obsolète (HTTP, mobile cassé, looks_outdated)
  OU PageSpeed 30-69 OU 4+ drapeaux mauvais sur 7
- **0.3 - 0.5** : site correct (PageSpeed 70-89, 2-3 drapeaux mauvais)
  avec marges d'optimisation
- **< 0.3** : site moderne PageSpeed 90+ (peu d'opportunité pour nous)

### Reach (25 %) — **formule unifiée**

Calcul additif, plafonne à **1.0** :

| Signal | Contribution |
|---|---|
| Téléphone valide trouvé | **+0.4** |
| Email `valid` (vérifié deliverable) | **+0.4** |
| Email `risky` (catch-all, role-based, disposable) | **+0.2** |
| Email `invalid` ou absent | 0 |
| Dirigeant identifié (`first_name` + `last_name`) | **+0.2** |
| LinkedIn vérifié (`linkedin_verified = true`) | **+0.1** |

**Règles** :

- `email_verified` provient de `prospection-email-verification` (4 verdicts)
- Si email perso (gmail/yahoo/etc.) avec verdict `valid`, comptabiliser
  comme `valid` ici — la distinction pro/perso vit dans `raw_payload.email_type`
- Plafond strict à 1.0 (un lead avec tel + email valid + dirigeant +
  LinkedIn fait 1.1 → on cap à 1.0)

### Budget (25 %)

Signaux observables, par ordre de fiabilité décroissante :

**Niveau 1 — signaux Pappers (les plus fiables)** :

- `raw_payload.pappers.ca_declared` > 100 k€ : **+0.4**
- `raw_payload.pappers.ca_declared` 50-100 k€ : +0.25
- `raw_payload.pappers.ca_declared` < 50 k€ : +0.1
- `raw_payload.pappers.capital_social` > 10 k€ : +0.15
- `raw_payload.pappers.effectif_reel` > 5 : +0.1
- Ancienneté (`date_creation` > 3 ans) : +0.1

**Niveau 2 — signaux Google Places (fallback si pas de Pappers)** :

- Note Google ≥ 4.0 ET ≥ 30 avis : +0.5
- Note Google ≥ 4.0 ET 15-29 avis : +0.3
- Note Google ≥ 4.0 ET < 15 avis : +0.1
- Note < 4.0 ou pas de note : 0

**Bonus transverses** :

- Effectif Pappers > 5 (si dispo) : +0.1
- Société active depuis > 3 ans : +0.1

Plafond à 1.0. Privilégier niveau 1 (Pappers) si dispo, sinon niveau 2.

## Calcul final

    score = (fit + pain + reach + budget) * 0.25
    score = round(score, 2)

    if score >= 0.65 → priority = "Oui"
    else              → priority = "Non"

## Calcul `quality_score` (0-100, distinct de `score`)

Le `quality_score` mesure la **complétude des données** (pas la
qualité commerciale du lead). C'est lui qui pilote le badge couleur
dans le CRM kanban.

| Critère | Points |
|---|---|
| `email_verified = 'valid'` | 30 |
| `email_verified = 'risky'` | 15 |
| `linkedin_verified = true` | 20 |
| `company_active = true` | 20 |
| Dirigeant identifié (`first_name` + `last_name`) | 15 |
| Téléphone présent | 10 |
| Site audité (`pagespeed_score` OU `raw_payload.site_audit` rempli) | 5 |

Plafonne à 100.

**Mapping badge couleur CRM** :

- ≥ 80 → 🟢 carte verte (suggérée pour `to_contact`)
- 40-79 → 🟡 carte orange (vérif partielle)
- < 40 → 🔴 carte rouge (à examiner manuellement)

## Seuils de décision (source unique)

| Condition | Action |
|---|---|
| `score < 0.40` | SKIP |
| `quality_score < 35` | SKIP |
| `company_active = false` | SKIP (entreprise radiée/liquidée) |
| Pas de tel ET `email_verified = 'invalid'` | SKIP (lead intouchable) |
| Dirigeant non identifié ET `email_verified = 'unverified'` | SKIP (incontactable de façon personnalisée) |
| Sinon | **INSERT** dans `lead_imports` avec `pipeline_stage='verified'` |

Ces seuils sont appliqués par `lead-intake-prompt.md` étape 11.
L'Agent Enrichissement ne **skip jamais** (il enrichit l'existant),
mais il recalcule `score` et `quality_score` après chaque update.

## Stockage dans `raw_payload`

    "score": 0.78,
    "priority": "Oui",
    "score_breakdown": {
      "fit": 0.85,
      "pain": 0.95,
      "reach": 0.7,
      "budget": 0.6
    },
    "quality_score": 88

## Exemples (avec la formule Reach unifiée)

### Coiffeur de quartier sans site, 4.7/142 avis Google

- **Fit** : 0.95 (artisan local FR, parfaitement ciblé)
- **Pain** : 0.95 (zéro site web)
- **Reach** : tel +0.4, email valid +0.4 (trouvé via mentions légales),
  dirigeant +0.2, pas de LinkedIn = **1.0**
- **Budget** : pas de Pappers ici (TPE), niveau 2 : note 4.7 + 142 avis ≥ 30 = +0.5, effectif inconnu, ancienneté inconnue = **0.5**

→ score = (0.95 + 0.95 + 1.0 + 0.5) × 0.25 = 3.4 × 0.25 = **0.85** → priority **Oui**

### Restaurant avec site Wix gratuit, 3.9/12 avis Google, pas de tel pro

- **Fit** : 0.9
- **Pain** : 0.75 (site obsolète, pas de booking, pas de menu en ligne, PageSpeed ~50)
- **Reach** : pas de tel = 0, email risky +0.2, dirigeant +0.2, LinkedIn +0.1 = **0.5**
- **Budget** : niveau 2 : 3.9/12 avis = 0 (sous 4.0 ou < 15 avis avec note OK) = **0.1**

→ score = (0.9 + 0.75 + 0.5 + 0.1) × 0.25 = 2.25 × 0.25 = **0.56** → priority **Non** mais inséré (≥ 0.40)

### PME industrielle 30 salariés, site daté sans portail client (Pappers OK)

- **Fit** : 0.8 (TPE 10-49 salariés, secteur compatible)
- **Pain** : 0.7 (site fonctionnel mais obsolète, pas d'auto)
- **Reach** : tel +0.4, email valid +0.4, dirigeant +0.2, LinkedIn +0.1 = **1.0** (capped)
- **Budget** : niveau 1 Pappers : CA déclaré 800 k€ = +0.4, capital 50 k€ = +0.15, effectif > 5 = +0.1, ancienneté > 3 ans = +0.1 = **0.75**

→ score = (0.8 + 0.7 + 1.0 + 0.75) × 0.25 = 3.25 × 0.25 = **0.81** → priority **Oui**

### Cabinet d'avocat avec site moderne complet

- **Fit** : 0.6 (secteur OK mais nos services moins percutants)
- **Pain** : 0.25 (site complet)
- **Reach** : tel +0.4, email valid +0.4, dirigeant +0.2, LinkedIn +0.1 = **1.0**
- **Budget** : niveau 1 Pappers : CA 300 k€ = +0.25, capital +0.15, effectif < 5 = 0, ancienneté +0.1 = **0.5**

→ score = (0.6 + 0.25 + 1.0 + 0.5) × 0.25 = 2.35 × 0.25 = **0.59** → priority **Non** mais inséré

### Gros groupe BTP 200 salariés (hors cible)

- **Fit** : 0.3 (hors cible — trop gros, tranche Pappers 22 = 100-199)
- **Pain** : 0.5
- **Reach** : 0.5
- **Budget** : 1.0

→ score = (0.3 + 0.5 + 0.5 + 1.0) × 0.25 = 2.3 × 0.25 = **0.58** → priority **Non**, mais inséré (≥ 0.40). À reconsidérer manuellement (probablement à `dismiss`).

## Règles strictes

- ❌ JAMAIS dupliquer la formule Reach ou les seuils ailleurs — toujours
  référencer ce fichier
- ❌ JAMAIS appliquer `score < 0.30` (ancien seuil) — c'est désormais `< 0.40`
- ❌ JAMAIS oublier de calculer `quality_score` à l'INSERT et à chaque UPDATE
- ✅ Si Pappers indispo, fallback Google Places sans pénalité
- ✅ Le `score` mesure la qualité commerciale, le `quality_score` la
  complétude des données — ne pas confondre
- ✅ Garder les exemples ci-dessus à jour quand la formule évolue (sinon
  c'est un bug d'incohérence)
