import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// A diferencia de Vitest (vitest.setup.ts) y de Next.js, Playwright no carga
// .env.local por su cuenta — sin esto, tests/e2e/auth.setup.ts y las specs
// que arman su propio cliente de Supabase ven process.env vacío.
loadEnv({ path: ".env.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      // Proyecto de "setup": corre como un test normal, así Playwright
      // garantiza que webServer ya está arriba antes de ejecutarlo — a
      // diferencia de globalSetup, cuyo orden relativo a webServer no está
      // garantizado.
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "authenticated",
      testMatch: /admin-flow\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/admin.json",
      },
    },
    {
      name: "anonymous",
      testMatch: /anonymous-visibility\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
