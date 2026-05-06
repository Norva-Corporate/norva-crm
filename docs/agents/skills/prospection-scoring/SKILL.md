---
name: prospection-scoring
description: Use this skill to score a prospect on 4 weighted axes (Fit, Pain, Reach, Budget) and decide if they qualify for insertion into the CRM. The weighting is biased toward Pain (40%) since our value proposition centers on fixing digital weaknesses. Returns a final score (0.0-1.0), a priority flag (Yes/No at threshold 0.65), a per-axis breakdown, and a Yes/No insertion decision (skip below 0.45).
---

# Skill — Scoring 4 axes

## Pondération

| Axe | Pondération | Justification |
|-----|-------------|---------------|
| Fit | 25% | Cible métier/géographique ? |
| **Pain** | **40%** | Notre fit principal — ils ont besoin de nos services |
| Reach | 20% | Peut-on les contacter de façon réaliste ? |
| Budget | 15% | Capacité de payer notre prestation |

## Comment scorer chaque axe (0.0 à 1.0)

### Fit (25%)

- 0.9 - 1.0 : artisan / commerce local FR ou petite startup tech FR,
  secteur parfaitement ciblé
- 0.6 - 0.8 : secteur acceptable mais hors cœur de cible
- 0.4 - 0.5 : grande entreprise, hors France, secteur peu compatible
- < 0.4 : hors cible totale (administration, multinationale, etc.)

### Pain (40%) — AXE PRINCIPAL

- **0.9 - 1.0** : aucun site web (best case)
- 0.7 - 0.9 : site obsolète/cassé (HTTP, pas mobile, vieux design,
  formulaire en panne)
- 0.5 - 0.7 : site potable mais sans booking / sans tarifs / sans
  automatisation
- 0.3 - 0.5 : site moderne fonctionnel avec quelques manques
- < 0.3 : site complet et professionnel (peu d'opportunité pour nous)

### Reach (20%)

Calcul additif :

- Téléphone valide trouvé : +0.5
- Email pro trouvé : +0.3
- Dirigeant identifié (prénom + nom) : +0.2

Plafonne à 1.0.

### Budget (15%)

- 0.7 - 1.0 : note Google >= 4.0 ET >= 30 avis = clientèle = CA solide.
  Bonus si effectif Pappers > 5.
- 0.4 - 0.7 : critères mitigés
- 0.2 - 0.4 : peu d'avis ou note faible (CA probablement faible)
- < 0.2 : aucun signe d'activité commerciale

## Calcul final

    score = (fit * 0.25) + (pain * 0.40) + (reach * 0.20) + (budget * 0.15)
    score = round(score, 2)

    if score >= 0.65 → priority = "Oui"
    else              → priority = "Non"

    if score < 0.45 → SKIP, ne pas insérer le prospect

## Stockage

Dans `raw_payload` :

    "score": 0.78,
    "priority": "Oui",
    "score_breakdown": {
      "fit": 0.85,
      "pain": 0.95,
      "reach": 0.7,
      "budget": 0.6
    }

## Exemples

### Coiffeur de quartier sans site, 4.7/142 avis Google

- Fit : 0.95 (artisan local FR, parfaitement ciblé)
- Pain : 0.95 (zéro site web)
- Reach : 0.5 (téléphone seul, pas d'email pro)
- Budget : 0.85 (note + avis nombreux = CA solide)

→ score = (0.95 × 0.25) + (0.95 × 0.40) + (0.5 × 0.20) + (0.85 × 0.15)
       = 0.2375 + 0.38 + 0.10 + 0.1275
       = **0.85** → priority **Oui**

### Restaurant avec site Wix gratuit, 3.9/12 avis

- Fit : 0.9
- Pain : 0.75 (site obsolète, pas de booking, pas de menu en ligne)
- Reach : 0.8 (tel + email pro + nom du gérant)
- Budget : 0.4 (peu d'avis = peu de clientèle)

→ score = 0.225 + 0.30 + 0.16 + 0.06 = **0.74** → priority **Oui**

### Cabinet d'avocat avec site moderne complet

- Fit : 0.6 (secteur OK mais nos services moins percutants)
- Pain : 0.25 (site complet)
- Reach : 0.9
- Budget : 0.9

→ score = 0.15 + 0.10 + 0.18 + 0.135 = **0.57** → priority **Non** mais
inséré (>= 0.45), à traiter en priorité basse.

### Gros groupe BTP 200 salariés

- Fit : 0.3 (hors cible — trop gros)
- Pain : 0.5
- Reach : 0.5
- Budget : 1.0

→ score = 0.075 + 0.20 + 0.10 + 0.15 = **0.53** → priority **Non**, mais
inséré. À reconsidérer manuellement.
