---
name: prospection-site-audit
description: Use this skill when a prospect has a website URL and you need to evaluate if their digital presence has weaknesses (HTTPS, mobile-friendliness, online booking, pricing display, contact form, freshness, platform). The output flags feed the Pain score — the higher the Pain, the better the prospect for our offer of website creation and automation.
---

# Skill — Audit du site d'un prospect

## Quand utiliser cette skill

Quand un prospect retourne un `websiteUri` non-null depuis Google
Places. **Pas si le prospect n'a aucun site** — dans ce cas Pain = 0.9+
automatiquement, pas besoin d'audit.

## Procédure

1. Fetch la page d'accueil avec WebFetch
2. Évalue les 7 drapeaux ci-dessous
3. Si pertinent (page d'accueil pauvre), fetch aussi `/contact`,
   `/tarifs`, `/reservation`

## Drapeaux à évaluer

| Drapeau | Mauvais signe (= +Pain) |
|---------|-------------------------|
| `has_https` | URL en `http://` au lieu de `https://` |
| `is_mobile_friendly` | Pas de balise `<meta name="viewport">` |
| `has_online_booking` | Aucun lien "Prendre RDV" / "Réserver" / "Booking" |
| `has_pricing` | Aucun tarif affiché (pour services tarifables : coiffeur, kiné, salle de sport, restaurant, etc.) |
| `has_contact_form` | Pas de `<form>` ni d'email cliquable |
| `looks_outdated` | Footer mentionne année <= 2020, design 1990s/2000s, polices Comic Sans, gifs animés |
| `platform_guess` | "Wix gratuit", "Pages perso Free", "FreeWebHost", "OVH default", template visuellement basique |

## Output

JSON à stocker dans `raw_payload.site_audit` :

    {
      "has_website": true,
      "has_https": false,
      "is_mobile_friendly": false,
      "has_online_booking": false,
      "has_pricing": false,
      "has_contact_form": true,
      "looks_outdated": true,
      "platform_guess": "Wix gratuit"
    }

## Cas "pas de site"

Si le prospect n'a pas de site :

    "site_audit": { "has_website": false }

→ Pain score 0.9+ automatique, pas besoin d'appeler cette skill.

## Comment ces drapeaux influencent le Pain

| Combinaison | Pain estimé |
|-------------|-------------|
| `has_website: false` | 0.9 - 1.0 |
| Site cassé / 404 / domaine parqué | 0.85 |
| 4+ drapeaux mauvais sur 7 | 0.75 - 0.85 |
| 2-3 drapeaux mauvais | 0.5 - 0.7 |
| 0-1 drapeau mauvais | 0.2 - 0.4 |

Voir aussi la skill `prospection-scoring` pour le calcul global.

## Erreurs HTTP

- 404 / 5xx : site cassé → `has_website: true`, `site_broken: true`,
  Pain élevé
- Timeout / ConnectionRefused : domaine probablement abandonné →
  comme cassé
- Redirection vers domain parking (sedo, godaddy, etc.) → considère
  comme pas de site
