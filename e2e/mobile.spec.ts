import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("affichage mobile sans débordement horizontal", async ({ page }) => {
  for (const path of ["/", "/recherche", "/assistant", "/connexion"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/mobile${path.replace(/\//g, "_") || "_"}.png` });
  }
  await page.goto("/recherche");
  const first = page.getByRole("link", { name: "Voir le logement" }).first();
  await first.click();
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/mobile_detail.png` });
});
