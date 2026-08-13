import { test, expect, request as playwrightRequest } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

test.describe("Visitante sin sesión (FR-022)", () => {
  let existingSlug: string | null = null

  test.beforeAll(async () => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase.from("pets").select("slug").limit(1).maybeSingle()
    existingSlug = data?.slug ?? null
  })

  test("no ve ningún control de edición en el catálogo", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Agregar" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0)
  })

  test("no ve ningún control de edición en una ficha", async ({ page }) => {
    test.skip(!existingSlug, "No hay ninguna mascota en la base para probar la ficha.")
    await page.goto(`/mascotas/${existingSlug}`)
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Agregar hito" })).toHaveCount(0)
  })

  test("rutas protegidas redirigen a /login", async ({ page }) => {
    await page.goto("/mascotas/nueva")
    await page.waitForURL(/\/login\?next=/)
  })

  test("el HTML de servidor no filtra controles de admin ni con sesión activa (contracts/service-worker.md)", async ({
    baseURL,
  }) => {
    // Un service worker que cachea /  y /mascotas/[slug] con NetworkFirst
    // (research.md §1) exige que esas rutas devuelvan el mismo documento sin
    // importar quién las pida — se verifica con la cookie de una sesión
    // admin real, no solo desde un visitante anónimo.
    const adminContext = await playwrightRequest.newContext({
      baseURL,
      storageState: "tests/e2e/.auth/admin.json",
    })

    const homeHtml = await (await adminContext.get("/")).text()
    expect(homeHtml).not.toContain("Editar")
    expect(homeHtml).not.toContain("Agregar hito")
    expect(homeHtml).not.toContain("Cerrar sesión")

    test.skip(!existingSlug, "No hay ninguna mascota en la base para probar la ficha.")
    const petHtml = await (await adminContext.get(`/mascotas/${existingSlug}`)).text()
    expect(petHtml).not.toContain("Editar")
    expect(petHtml).not.toContain("Agregar hito")
    expect(petHtml).not.toContain("Cerrar sesión")

    await adminContext.dispose()
  })
})
