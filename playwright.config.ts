import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright pour Norva CRM.
 *
 * - Tests sous `e2e/` (séparé de `src/`, jamais embarqué dans le bundle).
 * - Cible par défaut : http://localhost:3000 (next dev). Override via
 *   `BASE_URL=https://crm-preview.vercel.app npm run test:e2e`.
 * - 1 seul navigateur (Chromium) par défaut pour rester rapide. Ajouter
 *   firefox/webkit dans `projects` quand on veut élargir.
 * - Pas de `webServer` configuré : on suppose que `npm run dev` tourne
 *   déjà (sinon CI peut le wrap). Évite de geler les tests si le port
 *   est déjà occupé.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
