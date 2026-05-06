---
name: pain-digital-detection
description: Use this skill to read a Norva contact/company/lead and identify the dominant digital pain point (no website / outdated site / no online booking / weak Google presence / no SEO / etc.). The output is a structured pain summary used to personalize cold outreach. Reads from raw_payload.site_audit, tags, sector, and review counts. Returns the top-1 pain plus a one-line angle ready to use in a cold message.
---

# Skill — Détection du pain digital principal

## Quand utiliser

Avant de générer un message cold (email, tel, LinkedIn, SMS), pour
identifier **le bon angle d'attaque**.

## Input

Une fiche contact ou lead complète (depuis `lead_imports.raw_payload`
ou en agrégeant `contacts` + `companies` + leur `activities`).

## Logique de détection (ordre de priorité)

Évalue dans cet ordre, prend le PREMIER match :

### 1. Pas de site web → Pain max

Signal : `raw_payload.site_audit.has_website == false` ou
`raw_payload.website == null`.

Pain = "Aucun site web visible en ligne — perte de prospects qui
cherchent en ligne avant d'appeler"

Angle = "Vos clients potentiels vous cherchent sur Google et ne
trouvent rien : on peut changer ça en 2 semaines."

Service à proposer : **Site web vitrine** (avec module de prise de
RDV si le secteur s'y prête).

### 2. Site obsolète / cassé / non-HTTPS → Pain élevé

Signal : `raw_payload.site_audit.has_https == false` OU
`looks_outdated == true` OU `site_broken == true`.

Pain = "Site obsolète qui décrédibilise votre image pro"

Angle = "Votre site est encore en HTTP / Wix / template 2015 — Google
le pénalise et vos clients aussi."

Service à proposer : **Refonte de site** + SEO local en bonus.

### 3. Pas de prise de RDV en ligne (pour secteurs concernés)

Secteurs cibles : Coiffure, Esthétique, Kiné, Médecine, Dentaire,
Vétérinaire, Yoga / bien-être, Salle de sport, Automobile.

Signal : site existe mais
`raw_payload.site_audit.has_online_booking == false`.

Pain = "Aucune prise de RDV en ligne — vous perdez des clients hors
horaires d'ouverture (60% des prises de RDV se font en soirée)"

Angle = "Vos concurrents permettent à leurs clients de prendre RDV à
22h, vous non. C'est ~30% de CA en plus."

Service à proposer : **Module RDV en ligne** intégré au site.

### 4. Faible présence Google (peu d'avis ou note < 4.0)

Signal : `review_count < 20` OU `google_rating < 4.0`.

Pain = "Très peu présent sur Google — invisible dans les recherches
locales"

Angle = "Vous avez seulement <X> avis Google contre 80+ pour vos
concurrents directs. Sur les recherches locales, ça vous coûte cher."

Service à proposer : **SEO local + Google Ads** + optimisation de la
fiche Google Business.

### 5. Pas de tarifs affichés (services tarifables)

Signal : site existe mais
`raw_payload.site_audit.has_pricing == false` ET secteur dans
[Coiffure, Esthétique, Kiné, Avocat, Comptable, Yoga, Salle de sport].

Pain = "Aucun tarif affiché — vous perdez les prospects qui cherchent
à comparer avant de contacter"

Angle = "70% des consommateurs abandonnent un site qui n'affiche pas
de prix. Avec une grille claire, vous filtrez les sérieux."

Service à proposer : **Refonte page tarifs** ou ajout d'une grille
moderne (souvent inclus dans une refonte).

### 6. Site mobile cassé

Signal : `raw_payload.site_audit.is_mobile_friendly == false`.

Pain = "Site illisible sur mobile (>70% du trafic local)"

Service : refonte responsive.

### 7. Aucun pain identifiable → Skip ou note "Site OK"

Si rien des 6 critères → l'agent doit signaler que ce contact n'est
**pas un fit fort** pour le cold outreach. Marque-le pour reprise
manuelle.

## Output

Format JSON à utiliser dans la skill `redaction-cold-outreach` :

    {
      "pain_id": "no_website",
      "pain_short": "Pas de site web visible",
      "pain_angle": "Vos clients potentiels vous cherchent sur Google et ne trouvent rien.",
      "service_proposed": "Site vitrine + RDV en ligne",
      "fit_strength": "high"  // high | medium | low
    }

Codes `pain_id` :

- `no_website`
- `outdated_site`
- `no_online_booking`
- `weak_google_presence`
- `no_pricing`
- `mobile_broken`
- `none` (skip)

## Règles strictes

- ❌ Ne jamais inventer un pain qui n'est pas étayé par les données
  `raw_payload`
- ❌ Si plusieurs pains, n'en sors **qu'un seul** (le plus impactant)
- ✅ Privilégie le pain le plus visible/objectivable (ex : pas de site
  > site moche subjectif)
- ✅ Si fit_strength = "low", ne génère pas de message cold (passe
  à la skill suivante avec un skip)
