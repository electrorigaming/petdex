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
      // anonymous-visibility.spec.ts navega sin sesión (use.storageState no
      // se define acá), pero un test hace además un fetch autenticado con
      // el archivo que deja auth.setup.ts (contracts/service-worker.md) —
      // depende de "setup" para que ese archivo exista antes de correr.
      name: "anonymous",
      testMatch: /anonymous-visibility\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // offline-sighting.spec.ts (User Story 5) necesita sesión admin igual
      // que "authenticated", pero en su propio proyecto: usa
      // context.setOffline(), que conviene aislar de admin-flow.spec.ts para
      // que ninguno de los dos corra con la red del otro alterada por
      // casualidad si Playwright decide compartir un worker.
      name: "offline",
      testMatch: /offline-sighting\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/admin.json",
      },
    },
  ],
});
