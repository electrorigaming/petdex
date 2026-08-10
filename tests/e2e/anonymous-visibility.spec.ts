import { test, expect } from "@playwright/test"
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
    await expect(page.getByRole("link", { name: "Dar de alta" })).toHaveCount(0)
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
})
