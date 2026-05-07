---
name: prospection-scoring
description: Use this skill to score a prospect on 4 evenly weighted axes (Fit, Pain, Reach, Budget — 25% each) and decide if they qualify for insertion into the CRM. Returns a final score (0.0-1.0), a priority flag (Yes/No at threshold 0.65), a per-axis breakdown, and a Yes/No insertion decision (skip below 0.30).
---

# Skill — Scoring 4 axes

## Pondération

| Axe | Pondération | Justification |
|-----|-------------|---------------|
| Fit | 25 % | Cible métier / géographique / taille |
| Pain | 25 % | Faiblesse digitale = opportunité commerciale |
| Reach | 25 % | Faisabilité du contact (tel, email, dirigeant) |
| Budget | 25 % | Capacité à payer la prestation |

## Comment scorer chaque axe (0.0 à 1.0)

### Fit (25 %)

- 0.9 - 1.0 : artisan / commerce local FR ou petite startup tech FR,
  pile dans la cible historique
- 0.7 - 0.9 : PME ou ETI FR avec besoin digital identifié
  (site daté, pas d'automatisation, secteur compatible)
- 0.4 - 0.7 : secteur ou taille périphérique
- < 0.4 : hors cible totale (administration publique, multinationale
  > 5000 salariés, secteur incompatible)

### Pain (25 %)

- **0.9 - 1.0** : aucun site web (best case)
- 0.7 - 0.9 : site obsolète/cassé (HTTP, pas mobile, vieux design,
  formulaire en panne)
- 0.5 - 0.7 : site potable mais sans booking / sans tarifs / sans
  automatisation
- 0.3 - 0.5 : site moderne fonctionnel avec quelques manques
- < 0.3 : site complet et professionnel (peu d'opportunité pour nous)

### Reach (25 %)

Calcul additif :

- Téléphone valide trouvé : +0.5
- Email pro trouvé : +0.3
- Dirigeant identifié (prénom + nom) : +0.2

Plafonne à 1.0.

### Budget (25 %)

- 0.7 - 1.0 : note Google >= 4.0 ET >= 30 avis = clientèle = CA solide.
  Bonus si effectif Pappers > 5.
- 0.4 - 0.7 : critères mitigés
- 0.2 - 0.4 : peu d'avis ou note faible (CA probablement faible)
- < 0.2 : aucun signe d'activité commerciale

## Calcul final

    score = (fit + pain + reach + budget) * 0.25
    score = round(score, 2)

    if score >= 0.65 → priority = "Oui"
    else              → priority = "Non"

    if score < 0.30 → SKIP, ne pas insérer le prospect

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

→ score = (0.95 + 0.95 + 0.5 + 0.85) × 0.25
       = 3.25 × 0.25
       = **0.81** → priority **Oui**

### Restaurant avec site Wix gratuit, 3.9/12 avis

- Fit : 0.9
- Pain : 0.75 (site obsolète, pas de booking, pas de menu en ligne)
- Reach : 0.8 (tel + email pro + nom du gérant)
- Budget : 0.4 (peu d'avis = peu de clientèle)

→ score = (0.9 + 0.75 + 0.8 + 0.4) × 0.25 = 2.85 × 0.25 = **0.71**
→ priority **Oui**

### PME industrielle 80 salariés, site daté sans portail client

- Fit : 0.8 (PME FR, secteur compatible)
- Pain : 0.7 (site fonctionnel mais obsolète, pas d'auto)
- Reach : 0.9 (tel + email pro + dirigeant identifié via LinkedIn)
- Budget : 0.9 (effectif + CA solides)

→ score = (0.8 + 0.7 + 0.9 + 0.9) × 0.25 = 3.3 × 0.25 = **0.83**
→ priority **Oui**

### Cabinet d'avocat avec site moderne complet

- Fit : 0.6 (secteur OK mais nos services moins percutants)
- Pain : 0.25 (site complet)
- Reach : 0.9
- Budget : 0.9

→ score = (0.6 + 0.25 + 0.9 + 0.9) × 0.25 = 2.65 × 0.25 = **0.66**
→ priority **Oui** de justesse, à traiter en priorité moyenne.

### Gros groupe BTP 200 salariés

- Fit : 0.3 (hors cible — trop gros)
- Pain : 0.5
- Reach : 0.5
- Budget : 1.0

→ score = (0.3 + 0.5 + 0.5 + 1.0) × 0.25 = 2.3 × 0.25 = **0.58**
→ priority **Non**, mais inséré (>= 0.30). À reconsidérer manuellement.
