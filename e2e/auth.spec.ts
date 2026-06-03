import { test, expect } from "@playwright/test";

/**
 * Test d'authentification.
 *
 * Skip par défaut (auth Supabase nécessite des credentials réels en
 * variable d'env). Pour activer : poser E2E_TEST_EMAIL et
 * E2E_TEST_PASSWORD dans `.env.local` ou via CI secrets.
 *
 * À utiliser en cas de besoin pour valider que :
 *  - login fonctionne
 *  - la session persiste sur dashboard
 *  - logout marche
 */

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.describe("Auth flow", () => {
  test.skip(
    !email || !password,
    "E2E_TEST_EMAIL et E2E_TEST_PASSWORD requis pour ce test."
  );

  test("login → dashboard accessible", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/mot de passe/i).fill(password!);

    await page.getByRole("button", { name: /se connecter|connexion/i }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByText(/dashboard|tableau de bord/i).first()).toBeVisible();
  });
});
