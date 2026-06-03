# Tests E2E — Playwright

Tests bout-en-bout pour Norva CRM. Pour l'instant minimaliste : smoke
tests + auth (gated par variables d'environnement).

## Lancer en local

```bash
# 1. App qui tourne
npm run dev

# 2. Tests dans un autre terminal
npm run test:e2e           # headless
npm run test:e2e:ui        # mode UI (debug, watch)
npm run test:e2e:headed    # navigateur visible
```

## Cibler Vercel preview

```bash
BASE_URL=https://norva-crm-git-<branch>-norva.vercel.app npm run test:e2e
```

## Tests d'auth

Les tests `auth.spec.ts` sont skip par défaut. Pour les activer :

```bash
# .env.local
E2E_TEST_EMAIL=tu@norva.test
E2E_TEST_PASSWORD=...
```

ATTENTION : utiliser un compte dédié aux tests, pas un compte de prod.

## Prochaines étapes

À ajouter quand le besoin se présente :
- Création/édition de contact (CRUD complet)
- Drag d'un lead dans le kanban (Pipeline)
- Génération PDF facture
- Génération brief
- Création dossier Drive
