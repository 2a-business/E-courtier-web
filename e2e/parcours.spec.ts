import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.DEMO_PASSWORD ?? "";
if (!PASSWORD) throw new Error("Définissez DEMO_PASSWORD (mot de passe passé à seed_demo --password).");
const SHOTS = process.env.E2E_SHOTS;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function login(page: Page, who: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(`${who}@demo.e-courtier.sn`);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"));
}

test("l'assistant ne renvoie que des annonces réelles", async ({ page }) => {
  await page.goto("/assistant");
  await page.getByLabel("Votre message").fill("Je cherche un appartement de trois pièces à Fann Hock à moins de 300 000 FCFA, avec balcon.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const cards = page.getByLabel("Logements proposés").getByRole("link");
  await expect(cards.first()).toBeVisible();
  await expect(page.getByText(/Voici \d+ logement/)).toBeVisible();
  await shot(page, "assistant");
  await cards.first().click();
  await expect(page).toHaveURL(/\/logements\//);
  await expect(page.getByRole("navigation", { name: "Fil d'Ariane" })).toContainText("Fann Hock");
  await shot(page, "listing-detail");
});

test("recherche filtrée et carte", async ({ page }) => {
  await page.goto("/recherche?transaction_type=SALE");
  await expect(page.getByRole("heading", { name: /Biens à vendre/ })).toBeVisible();
  await expect(page.getByText(/\d+ résultats?/)).toBeVisible();
  await page.getByLabel("Trier par").selectOption("price_asc");
  await expect(page).toHaveURL(/ordering=price_asc/);
});

test("réservation, confirmation, dossier, paiement simulé et contrat signé", async ({ browser }) => {
  const client = await browser.newPage();
  await login(client, "client");
  await client.goto("/recherche?district=Libert%C3%A9%206");
  await client.getByRole("link", { name: "Planifier une visite" }).first().click();
  await expect(client.getByText("Réserver une visite")).toBeVisible();
  await client.locator("fieldset button").first().click();
  await client.getByLabel("Message au propriétaire (facultatif)").fill("Bonjour, je suis disponible.");
  await shot(client, "visit-new");
  await client.getByRole("button", { name: "Confirmer la réservation" }).click();
  await expect(client.getByRole("heading", { name: "Demande envoyée !" })).toBeVisible();
  await shot(client, "visit-confirmation");
  await client.getByRole("link", { name: "Suivre ma visite" }).click();
  const visitUrl = client.url();

  const owner = await browser.newPage();
  await login(owner, "proprietaire");
  await owner.goto(visitUrl);
  await owner.getByRole("button", { name: "Confirmer la visite" }).click();
  await expect(owner.getByText("Confirmée").first()).toBeVisible();

  await client.reload();
  await expect(client.getByText(/Adresse fictive/)).toBeVisible();
  await shot(client, "visit-detail");
  await client.getByRole("link", { name: "Constituer mon dossier" }).click();
  await expect(client.getByText("Frais de dossier E-Courtier")).toBeVisible();
  await expect(client.getByText("5 000 FCFA").first()).toBeVisible();
  await client.getByRole("button", { name: "Ouvrir mon dossier" }).click();
  await expect(client.getByText("En attente — non payé.")).toBeVisible();
  await shot(client, "payment-pending");
  await client.getByRole("button", { name: "Simuler le paiement" }).click();
  await expect(client.getByText("Paiement SIMULÉ", { exact: true })).toBeVisible();
  await shot(client, "payment-simulated");
  await client.getByRole("link", { name: "Suivre le contrat" }).click();
  const contractUrl = client.url();

  await owner.goto(contractUrl);
  await owner.getByRole("button", { name: "Envoyer pour signature" }).click();
  await owner.getByRole("checkbox").check();
  await owner.getByRole("button", { name: "Signer", exact: true }).click();
  await expect(owner.getByText("Aucune signature")).toBeHidden();

  await client.reload();
  await client.getByRole("checkbox").check();
  await client.getByRole("button", { name: "Signer", exact: true }).click();
  await expect(client.getByText("Signé", { exact: true }).first()).toBeVisible();
  await shot(client, "contract-signed");
  await owner.goto("/tableau-de-bord");
  await expect(owner.getByRole("heading", { name: "Demandes de visite" })).toBeVisible();
  await shot(owner, "dashboard");
  await owner.goto("/tableau-de-bord?onglet=annonces");
  await shot(owner, "dashboard-listings");
});

test("validation administrative d'une annonce en attente", async ({ page }) => {
  await login(page, "admin");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText("Vérifications en attente")).toBeVisible();
  await shot(page, "admin-overview");
  await page.getByRole("tab", { name: "Vérifications" }).click();
  const first = page.locator("li").filter({ has: page.getByRole("button", { name: "Approuver" }) }).first();
  await expect(first).toBeVisible();
  await shot(page, "admin-verifications");
  await first.getByRole("button", { name: "Approuver" }).click();
  await expect(page.getByText("Approuver")).toHaveCount(await page.getByRole("button", { name: "Approuver" }).count());
  await page.getByRole("tab", { name: "Journal" }).click();
  await expect(page.getByText("verification.approved").first()).toBeVisible();
});

test("inscription publique sans rôle administrateur", async ({ page }) => {
  await page.goto("/inscription");
  await shot(page, "register");
  await expect(page.getByText("Je cherche un logement")).toBeVisible();
  await expect(page.getByText("Administrateur")).toHaveCount(0);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Prénom requis.")).toBeVisible();
});
