---
name: prospection-email-verification
description: Use this skill to verify if a prospect's email address is deliverable, using a free-tier chain (DNS MX → Hunter.io free 25/mo → Mailboxlayer free 100/mo → SMTP RCPT TO probe as last resort). Returns one of four verdicts (valid, risky, invalid, unverified) ready to write to lead_imports.email_verified. No paid service required. Skips the chain if email is null or already verified.
---

# Skill — Vérification de deliverability email (100% gratuit)

## Quand utiliser cette skill

À chaque fois qu'un lead a un email (qu'il soit pro ou perso) et que
`email_verified = 'unverified'`. Ne pas re-vérifier un email déjà
classé `valid`/`invalid` sauf si > 90 jours.

## Verdicts possibles

| Verdict | Sens | Action côté CRM |
|---|---|---|
| `valid` | Email syntaxiquement OK + MX existe + SMTP accepte (ou Hunter dit `deliverable`) | 🟢 OK pour cold mail |
| `risky` | Email accepté mais catch-all, role-based (`contact@`, `info@`), ou disposable | 🟡 Cold mail à risque, à valider à l'oral |
| `invalid` | Syntax cassée, MX absent, ou SMTP rejette (550) | 🔴 Ne pas envoyer |
| `unverified` | Tous les checks ont échoué (timeout, quota dépassé, etc.) | ⚪ Re-essayer plus tard |

## Chaîne de vérification (s'arrêter au premier verdict définitif)

### 1. Syntax check — instant, gratuit

Regex : `^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$` (case-insensitive,
trim espaces).

- Si fail → `invalid`, on s'arrête.

### 2. DNS MX lookup — quelques ms, gratuit, illimité

Via Bash :

    dig +short MX <domain> 2>/dev/null | head -3

Ou en cas d'absence de `dig` :

    nslookup -type=MX <domain>

- **Pas de MX retourné** → `invalid`, on s'arrête.
- **MX retourné** → on continue (le domaine peut recevoir, mais
  l'adresse précise peut être bidon).

### 3. Hunter.io email-verifier (free tier — 25/mois)

Si `HUNTER_API_KEY` présente dans l'env :

    curl "https://api.hunter.io/v2/email-verifier?email=<email>&api_key=$HUNTER_API_KEY"

Lecture de la réponse :

```json
{
  "data": {
    "status": "valid" | "invalid" | "accept_all" | "unknown" | "disposable" | "webmail",
    "result": "deliverable" | "undeliverable" | "risky" | "unknown",
    "score": 95
  }
}
```

Mapping :

| Hunter `result` | Notre verdict |
|---|---|
| `deliverable` | `valid` |
| `undeliverable` | `invalid` |
| `risky` | `risky` |
| `unknown` | passer à l'étape 4 |

⚠️ **Économiser le quota** : Hunter ne consomme pas pour les `webmail`
(gmail/yahoo/etc.) — ils renvoient instantanément `webmail`. Tu peux
zapper Hunter pour les emails perso et passer direct à l'étape 5.

### 4. Mailboxlayer (free tier — 100/mois)

Si `MAILBOXLAYER_API_KEY` présente :

    curl "http://apilayer.net/api/check?access_key=$MAILBOXLAYER_API_KEY&email=<email>&smtp=1&format=1"

Lecture :

```json
{
  "format_valid": true,
  "mx_found": true,
  "smtp_check": true,
  "catch_all": false,
  "role": false,
  "disposable": false,
  "score": 0.8
}
```

Mapping :

| Condition Mailboxlayer | Notre verdict |
|---|---|
| `format_valid=true` ET `mx_found=true` ET `smtp_check=true` ET pas catch_all/role/disposable | `valid` |
| `smtp_check=true` ET (catch_all OU role OU disposable) | `risky` |
| `format_valid=false` OU `mx_found=false` OU `smtp_check=false` | `invalid` |
| API erreur ou quota | passer à l'étape 5 |

### 5. SMTP RCPT TO probe — dernier recours, gratuit mais bancal

⚠️ **À utiliser seulement si** :
- Hunter + Mailboxlayer ont tous deux retourné `unknown` ou en panne
- Le domaine n'est PAS un webmail grand public (gmail/yahoo/outlook
  refusent les probes — verdict `risky` par défaut pour eux)

Procédure (script Bash courte, MX résolu à l'étape 2) :

    {
      echo "HELO norva-verify.test"
      sleep 0.2
      echo "MAIL FROM:<verify@norva-corporate.fr>"
      sleep 0.2
      echo "RCPT TO:<$EMAIL>"
      sleep 0.2
      echo "QUIT"
    } | timeout 10 nc -w 5 $MX_HOST 25

Lecture des codes :

| Code SMTP du serveur | Notre verdict |
|---|---|
| 250 / 251 | `valid` |
| 450 / 451 / 452 (greylist) | `risky` |
| 550 / 551 / 553 (user unknown) | `invalid` |
| timeout / refused | `unverified` |

**Attention** : beaucoup de serveurs (Office 365, Google Workspace)
acceptent tout au RCPT TO et rejettent après → tu auras des faux
`valid`. C'est pour ça qu'on garde Hunter en priorité.

## Cas spéciaux

### Email webmail (gmail/yahoo/outlook/etc.)

Les webmails refusent quasi tous les probes. Stratégie :

1. Syntax OK + MX présent (toujours le cas pour ces domaines) → `valid`
   par défaut
2. Si Hunter renvoie `webmail` → on accepte comme `valid` (la boîte
   existe en tant que possibilité)
3. **Tagger** `raw_payload.email_type = "personal"` (cf. skill
   `prospection-email-discovery`) pour la suite

### Email role-based (`contact@`, `info@`, `direction@`)

Verdict toujours `risky` même si techniquement deliverable — un humain
peut ne jamais lire ces boîtes.

### Email disposable (`mailinator`, `10minutemail`, `tempmail`...)

Liste à maintenir dans `raw_payload.email_disposable_check`. Toujours
`invalid` quel que soit le SMTP.

## Output — UPDATE à appliquer

Après chaque vérif :

    UPDATE public.lead_imports
    SET email_verified = '<verdict>',
        verified_at = now(),
        raw_payload = raw_payload || jsonb_build_object(
          'email_verification', jsonb_build_object(
            'method', '<dns|hunter|mailboxlayer|smtp>',
            'checked_at', now()::text,
            'details', '<extrait court de la réponse API>'
          )
        )
    WHERE id = '<lead_id>';

## Quota tracking

Ajouter dans `raw_payload.email_verification.quota_state` la position
estimée du quota (ex `"hunter_used": 8`). Permet à l'agent de switcher
de stratégie si on approche du plafond mensuel.

## Règles strictes

- ❌ JAMAIS écrire `valid` sans avoir au moins passé étape 2 (MX)
- ❌ JAMAIS faire un probe SMTP vers une adresse Gmail/Outlook
  (ban IP probable)
- ❌ JAMAIS dépasser le quota Hunter ou Mailboxlayer (l'agent track le
  reste mensuel via `raw_payload`)
- ✅ Économiser les quotas en cascadant : MX gratuit d'abord, payant en
  dernier
- ✅ Pour les emails perso (webmail), verdict `valid` par défaut + tag
  `email_type=personal`
- ✅ En cas d'incertitude, préférer `risky` à `valid` (un faux positif
  = un bounce = blacklist domaine)
