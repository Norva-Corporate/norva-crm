---
name: prospection-bodacc-check
description: Verify if a French company is still legally alive via BODACC (Bulletin Officiel des Annonces Civiles et Commerciales). Uses the free opendatasoft API (no auth, no quota). Returns boolean company_active and latest relevant announcement. Essential to skip leads on dead/bankrupt companies.
---

# Skill — Vérification BODACC

## Quand utiliser

Systématiquement à l'INSERT d'un lead, dès qu'un **SIREN** est dispo.
Sans SIREN → `company_active = NULL` (inconnu).

## API (gratuit, sans auth, illimité)

```
https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records
```

Params :
- `where=registre%20like%20%22<SIREN>%22`
- `order_by=dateparution%20desc`
- `limit=10`

```bash
curl "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?where=registre%20like%20%22552120222%22&order_by=dateparution%20desc&limit=10"
```

## Champs utiles dans `results[]`

- `dateparution` (YYYY-MM-DD)
- `familleavis` : `creation`, `modification`, `vente`, `radiation` ⚠️,
  `collectives` ⚠️, `depot`, `rectificatif`
- `typeavis_lib` : libellé court ("Radiation", "Jugement de liquidation",
  "Plan de cession")
- `tribunal`, `commercant`, `numerodepartement`

## Logique de décision

Parcourir les 10 annonces (plus récentes en premier) :

- `familleavis = 'radiation'` → `company_active = false`. STOP.
- `typeavis_lib` contient `'liquidation'` → `company_active = false`. STOP.
- `typeavis_lib` contient `'redressement'` → `company_active = true`
  MAIS `raw_payload.bodacc_check.warning = "redressement_en_cours"`. STOP.
- Sinon, annonce suivante.

Aucune annonce de radiation/liquidation en 10 dernières → `company_active = true`.

API renvoie 0 résultat → `company_active = true` (TPE/micro souvent
absentes de BODACC).

## Signal complémentaire — changement de dirigeant

Annonce `modification` < 12 mois mentionnant changement de gérant
(pattern : "Changement de gérant", "Modification du représentant légal",
"Nouveau président") → flagger :

```json
"leadership_change_detected": {
  "date": "<dateparution>",
  "note": "Annonce BODACC récente — vérifier dirigeant actuel"
}
```

## Output

```sql
UPDATE public.lead_imports
SET company_active = <true|false>,
    verified_at = now(),
    raw_payload = raw_payload || jsonb_build_object(
      'bodacc_check', jsonb_build_object(
        'checked_at', now()::text,
        'siren', '<SIREN>',
        'last_announcement', jsonb_build_object(
          'date', '<dateparution>',
          'famille', '<familleavis>',
          'type', '<typeavis_lib>'
        ),
        'warning', '<null | "redressement_en_cours" | "radiee">'
      )
    )
WHERE id = '<lead_id>';
```

## Règles strictes

- ❌ JAMAIS `company_active = false` sans annonce BODACC formelle
- ❌ JAMAIS skip si SIREN dispo (gratuit, rapide)
- ✅ Toujours stocker dernière annonce dans `raw_payload.bodacc_check`
- ✅ En doute, `company_active = true` (mieux qu'un faux négatif)
