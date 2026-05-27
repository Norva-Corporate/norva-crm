---
name: prospection-email-verification
description: Verify email deliverability via free-tier chain (DNS MX → Hunter.io free 25/mo → Mailboxlayer free 100/mo → SMTP RCPT TO probe). Returns one of 4 verdicts (valid, risky, invalid, unverified). 100% free.
---

# Skill — Vérification email (chaîne gratuite)

## Quand utiliser

Email présent ET `email_verified='unverified'` (ou > 90 jours).

## Verdicts

| Verdict | Sens | Action CRM |
|---|---|---|
| `valid` | Syntax OK + MX + SMTP accepte (ou Hunter `deliverable`) | 🟢 Cold mail OK |
| `risky` | Catch-all, role-based (`contact@`, `info@`), disposable | 🟡 Valider à l'oral |
| `invalid` | Syntax cassée, MX absent, SMTP 550 | 🔴 Ne pas envoyer |
| `unverified` | Tous checks ont échoué (timeout, quota) | ⚪ Retry plus tard |

## Chaîne (stop au 1er verdict définitif)

### 1. Syntax (regex)

`^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$`. Fail → `invalid`.

### 2. DNS MX (gratuit, illimité)

```bash
dig +short MX <domain> | head -3
```

Pas de MX → `invalid`. Sinon continuer.

### 3. Hunter.io (free 25/mois) — si `HUNTER_API_KEY`

```
GET https://api.hunter.io/v2/email-verifier?email=<email>&api_key=<key>
```

Mapping `result` → verdict : `deliverable` → `valid`,
`undeliverable` → `invalid`, `risky` → `risky`, `unknown` → étape 4.

⚠️ Hunter ne consomme pas le quota pour les `webmail` (gmail/yahoo) —
ils renvoient instantanément `webmail`. Pour ces domaines, zapper
Hunter et passer direct à `valid` (cf. cas spécial webmail).

### 4. Mailboxlayer (free 100/mois) — si `MAILBOXLAYER_API_KEY`

```
GET http://apilayer.net/api/check?access_key=<key>&email=<email>&smtp=1
```

Mapping :
- `format_valid + mx_found + smtp_check + !catch_all + !role + !disposable` → `valid`
- `smtp_check + (catch_all OU role OU disposable)` → `risky`
- `!format_valid OU !mx_found OU !smtp_check` → `invalid`

### 5. SMTP RCPT TO probe — dernier recours

⚠️ **Skip pour webmail** (Gmail/Outlook/Yahoo refusent les probes →
ban IP probable).

```bash
{ echo "HELO norva-verify.test"; sleep 0.2;
  echo "MAIL FROM:<verify@norva-corporate.fr>"; sleep 0.2;
  echo "RCPT TO:<$EMAIL>"; sleep 0.2;
  echo "QUIT"; } | timeout 10 nc -w 5 $MX_HOST 25
```

Codes : 250/251 → `valid` ; 450/451/452 → `risky` ; 550/551/553 → `invalid` ;
timeout → `unverified`.

⚠️ Office 365 et Google Workspace acceptent tout au RCPT TO → faux
positifs `valid`. Hunter en priorité quand possible.

## Cas spéciaux

- **Webmail** (gmail/yahoo/outlook) : MX présent toujours → `valid`
  par défaut + tag `raw_payload.email_type = "personal"`
- **Role-based** (`contact@`, `info@`, `direction@`) : toujours `risky`
- **Disposable** (mailinator, 10minutemail, tempmail) : toujours `invalid`

## Output

```sql
UPDATE public.lead_imports
SET email_verified = '<verdict>',
    verified_at = now(),
    raw_payload = raw_payload || jsonb_build_object(
      'email_verification', jsonb_build_object(
        'method', '<dns|hunter|mailboxlayer|smtp>',
        'checked_at', now()::text
      )
    )
WHERE id = '<lead_id>';
```

## Règles strictes

- ❌ JAMAIS `valid` sans avoir au moins passé MX
- ❌ JAMAIS probe SMTP vers Gmail/Outlook (ban IP)
- ❌ JAMAIS dépasser quota Hunter/Mailboxlayer
- ✅ Économiser : MX gratuit d'abord, payant en dernier
- ✅ Webmail → `valid` par défaut + tag `email_type=personal`
- ✅ En cas d'incertitude, préférer `risky` (un bounce = blacklist)
