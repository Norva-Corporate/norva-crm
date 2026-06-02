import { test, expect } from "@playwright/test";

/**
 * Smoke test minimal : la home doit rediriger vers /login,
 * et le formulaire login doit être visible. C'est le test "le serveur
 * tourne et l'app boot correctement". Pas d'auth, pas de DB.
 *
 * Pour lancer en local :
 *   1. `npm run dev` dans un terminal
 *   2. `npm run test:e2e` dans un autre terminal
 *
 * Pour cibler Vercel preview :
 *   BASE_URL=https://norva-crm-git-claude-beautiful-lalande-norva.vercel.app npm run test:e2e
 */
test("home → login redirect + formulaire login visible", async ({ page }) => {
  await page.goto("/");

  // Le middleware doit rediriger vers /login (utilisateur non-auth).
  await expect(page).toHaveURL(/\/login$/);

  // Le form login expose un champ email et password.
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/mot de passe/i)).toBeVisible();

  // Bouton de soumission présent.
  await expect(
    page.getByRole("button", { name: /se connecter|connexion/i })
  ).toBeVisible();
});

test("page login a un lien d'inscription", async ({ page }) => {
  await page.goto("/login");

  // Doit pointer vers /inscription (un des deux routes de l'app).
  const inscriptionLink = page.getByRole("link", { name: /inscription|créer un compte/i });
  await expect(inscriptionLink).toBeVisible();
  await expect(inscriptionLink).toHaveAttribute("href", /\/inscription/);
});
