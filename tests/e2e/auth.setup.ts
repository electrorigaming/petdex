import { test as setup } from "@playwright/test"
import { mkdirSync } from "node:fs"

const authFile = "tests/e2e/.auth/admin.json"

// Bootstrapea una sesión de admin real sin automatizar el consentimiento de
// Google (no viable de forma confiable en CI, research.md §6). Navega a la
// página solo-test que hace signInWithPassword con el browser client de
// @supabase/ssr, así las cookies quedan en el formato exacto que ese cliente
// espera — no se construyen a mano. Como "setup project" (no globalSetup),
// Playwright garantiza que webServer ya está arriba antes de correr esto.
setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_ADMIN_EMAIL
  const password = process.env.TEST_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error(
      "Faltan TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD en .env.local — ver quickstart.md."
    )
  }

  await page.goto(
    `/test/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
  )
  await page.waitForSelector("text=OK", { timeout: 15000 })

  mkdirSync("tests/e2e/.auth", { recursive: true })
  await page.context().storageState({ path: authFile })
})
