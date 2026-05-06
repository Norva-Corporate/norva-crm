---
name: redaction-cold-outreach
description: Use this skill to draft personalized cold outreach messages (phone script, cold email, LinkedIn DM, SMS) for a Norva prospect. Adapts tone automatically based on sector (tutoiement for artisans/local commerce, vouvoiement for liberal professions and B2B tech). Builds messages around a specific digital pain identified beforehand. Outputs all 4 variants — user picks the channel they want to use. Promotes Kylian's two main services: websites (vitrine, e-com, online booking) and local SEO + Google Ads.
---

# Skill — Rédaction cold outreach (4 variantes)

## Quand utiliser

Après détection du pain digital via `pain-digital-detection`. Génère
le kit de prise de contact complet pour 1 prospect.

## Input requis

- Identité prospect : `first_name`, `last_name`, `company_name`
- Pain détecté (objet de `pain-digital-detection`)
- Secteur (`raw_payload.sector`)
- Canal préféré (optionnel : "tel" / "email" / "linkedin" / "sms")

## Adaptation du ton selon secteur

### Tutoiement chaleureux (proximité, terrain)

Secteurs : Coiffure, Esthétique, Restauration, Boulangerie, Bâtiment,
Plomberie, Électricité, Menuiserie, Peinture, Carrosserie, Garage
auto, Paysagiste, Salle de sport, Yoga / bien-être, Photographie,
Autre artisanat, Autre commerce.

Conventions :
- Tutoiement
- Phrases courtes
- Vocabulaire concret, jamais "synergie" / "verticale"
- Utilise le prénom : "Salut Marie"

### Vouvoiement professionnel (cabinets, services)

Secteurs : Kiné, Médecine, Dentaire, Vétérinaire, Avocat, Comptable,
Notaire, Agent immobilier, Conseil, Formation.

Conventions :
- Vouvoiement
- Plus de respect formel
- "Bonjour Monsieur/Madame Dupont" en email, "Bonjour Marie" en tel
  si tu sens l'ouverture
- Vocabulaire pro mesuré

### Vouvoiement business (B2B tech / agences)

Secteurs : E-commerce, SaaS B2B, Agence digitale, Événementiel,
Médias et publicité.

Conventions :
- Vouvoiement
- Vocabulaire business OK ("ROI", "conversion", "pipeline")
- "Bonjour Marie" en première approche, plus direct

## Identité émetteur

Tu es **Kylian**, indépendant qui aide les artisans/TPE/PME à :

1. **Avoir un site web qui convertit** : vitrine, e-commerce, prise
   de RDV en ligne, paiement intégré
2. **Être visible localement sur Google** : SEO local, Google Ads,
   optimisation Google Business

Tes signatures :

- Email pro : Kylian Arcier — Norva — kylian.arcier@gmail.com
- Tel pro : (utiliser celui que Kylian fournira)

## Structure des 4 variantes

### Variante A — Script téléphonique (3 lignes max)

Format :

    [Accroche - 1 ligne, mention du pain]
    [Valeur - 1 ligne, ce qu'on peut faire concrètement]
    [Ask - 1 ligne, demande un créneau de 15 min]

Exemple (coiffeur, tutoiement, pain = pas de site) :

    "Salut Marie, c'est Kylian de Norva — j'ai vu que ton salon n'a
    pas encore de site, alors que tu as 142 avis Google.
    Je monte un site avec prise de RDV en ligne en 2 semaines pour
    les salons comme le tien.
    T'as 10 min mardi ou jeudi pour qu'on en parle ?"

Stocke comme `activity` type `call`, payload `{ body: "<script>", channel: "phone" }`.

### Variante B — Email cold (max 80 mots)

Structure :

- Objet : 5-7 mots, mentionne l'entreprise
- Ouverture : 1 ligne, observation factuelle (pas générique)
- Pain + valeur : 2 lignes
- Soft CTA : 1 question simple, pas "agendons un call de 30 min"

Exemple (kiné, vouvoiement, pain = pas de RDV en ligne) :

    Objet : Cabinet Dupont — RDV en ligne 24/7 ?

    Bonjour Marie Dupont,

    J'ai vu que votre cabinet n'a pas de prise de RDV en ligne sur
    le site. Vos confrères qui en ont récupèrent en moyenne 30% de
    consultations supplémentaires (créneaux le soir, le week-end).

    Vous seriez ouverte à un échange de 15 min cette semaine pour
    voir si ça vaut le coup pour vous ?

    Bien cordialement,
    Kylian Arcier — Norva

Stocke comme `activity` type `email`, payload
`{ subject, body, channel: "email" }`.

### Variante C — Message LinkedIn DM (max 50 mots)

Plus court, plus direct, conversational.

Exemple (PDG SaaS, vouvoiement business, pain = site obsolète) :

    Bonjour Marie, je suis Kylian, je fais des sites pour startups
    SaaS françaises. J'ai jeté un œil au site d'Acme — il y a un
    vrai potentiel d'amélioration sur le mobile et la conversion.
    Ça vous intéresse qu'on en discute 15 min ?

Stocke comme `activity` type `note`, payload
`{ body, channel: "linkedin" }`.

### Variante D — SMS post-appel manqué (max 160 caractères)

Très court, mention de l'appel, propose alternative.

Exemple (bâtiment, tutoiement, pain = site obsolète) :

    Salut Jean, c'est Kylian (Norva). J'ai essayé de te joindre pour
    parler de ton site web qui mérite un coup de jeune. Dispo demain
    après-midi ? — Kylian

Stocke comme `activity` type `note`, payload
`{ body, channel: "sms" }`.

## Format de sortie complet

Pour chaque prospect traité, génère 4 `activities` (une par canal),
toutes avec `created_by = <kylian_uuid>`, `entity_type = 'contact'`
(ou `'deal'` si c'est lié à un deal en pipeline), `entity_id =
<id>`.

Exemple INSERT batch :

    INSERT INTO public.activities (type, entity_type, entity_id, payload, created_by)
    VALUES
      ('call',  'contact', '<uuid>', '{"body": "<script>", "channel": "phone",  "draft": true}'::jsonb, '<kylian_uuid>'),
      ('email', 'contact', '<uuid>', '{"subject": "<obj>", "body": "<email>", "channel": "email", "draft": true}'::jsonb, '<kylian_uuid>'),
      ('note',  'contact', '<uuid>', '{"body": "<dm>", "channel": "linkedin", "draft": true}'::jsonb, '<kylian_uuid>'),
      ('note',  'contact', '<uuid>', '{"body": "<sms>", "channel": "sms", "draft": true}'::jsonb, '<kylian_uuid>');

## Règles strictes

- ❌ JAMAIS inventer un fait sur le prospect qui n'est pas dans
  `raw_payload`. Si tu n'as pas l'info, reste générique.
- ❌ Pas de promesses chiffrées non vérifiables ("on triple votre CA")
- ❌ Pas de "Cher" / "Chère" en email — démarre direct par "Bonjour <nom>"
- ❌ Pas de "j'espère que ce message vous trouvera bien" — banni
- ❌ Pas d'emojis 🚀💪 — démago
- ✅ Toujours **un seul CTA** par message
- ✅ Mentionne TOUJOURS un détail spécifique au prospect (nom commercial,
  nb d'avis, pain identifié) — c'est ce qui distingue d'un mailing de
  masse
- ✅ Marque les messages générés comme `draft: true` dans le payload —
  Kylian validera/éditera avant d'envoyer

## Anti-patterns à éviter

| À éviter | Pourquoi |
|---|---|
| "J'espère que vous allez bien" | Vide, signal "cold mail" |
| "Synergie", "verticale", "scaling" | Jargon |
| "Je me permets de vous contacter" | Auto-permission, mou |
| "Avez-vous 30 min cette semaine" | Trop demander en 1er contact |
| "Notre solution unique sur le marché" | Marketing creux |
| "PS." gimmicks | Trop ficelle |
| "Cliquez ici pour notre brochure" | Contact froid ≠ catalogue |
