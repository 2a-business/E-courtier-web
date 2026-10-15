import { defineConfig } from "@playwright/test";

/**
 * Parcours critiques de bout en bout. Prérequis : backend sur :8000 avec `seed_demo --password <DEMO_PASSWORD>`,
 * frontend sur :5173. Sur macOS 12, Playwright ne fournit plus Chromium : définir PW_CHROME_PATH
 * vers un Chrome compatible (ex. chrome-headless-shell 140).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    locale: "fr-FR",
    timezoneId: "Africa/Dakar",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
  },
});
