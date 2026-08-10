import path from "node:path"
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const PHOTO_FIXTURE = path.join(__dirname, "fixtures", "pet-photo.png")

test.describe("Flujo de administradora: alta, edición, hito, logout", () => {
  const petName = `E2E Firulais ${Date.now()}`
  let createdSlug: string

  test.afterAll(async () => {
    if (!createdSlug) return
    // Limpieza directa: la RLS ya quedó probada en tests/integration; acá
    // solo se borra el dato de prueba para no ensuciar el catálogo real.
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    await admin.from("pets").delete().eq("slug", createdSlug)
    await admin.auth.signOut()
  })

  test("alta con foto, edición con reemplazo, agregar hito, cerrar sesión", async ({ page }) => {
    await page.goto("/mascotas/nueva")
    await page.getByLabel("Nombre").fill(petName)
    await page.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE)
    await expect(page.getByText("Subiendo foto…")).toHaveCount(0, { timeout: 15000 })

    await page.getByRole("button", { name: "Guardar" }).click()
    // No alcanza con /\/mascotas\/[^/]+$/: esa misma URL de partida
    // (/mascotas/nueva) ya matchea el patrón, así que waitForURL se resuelve
    // al instante sin esperar el submit real. Se excluye explícitamente.
    await page.waitForURL(
      (url) => /^\/mascotas\/[^/]+$/.test(url.pathname) && url.pathname !== "/mascotas/nueva"
    )
    createdSlug = new URL(page.url()).pathname.split("/").pop()!

    await expect(page.getByRole("heading", { name: petName })).toBeVisible()
    await expect(page.getByRole("img", { name: petName })).toBeVisible()

    // Edición con reemplazo de foto
    await page.getByRole("link", { name: "Editar" }).click()
    await page.waitForURL(/\/editar$/)
    await page.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE)
    await expect(page.getByText("Subiendo foto…")).toHaveCount(0, { timeout: 15000 })
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForURL(new RegExp(`/mascotas/${createdSlug}$`))

    // Agregar hito — aparece en la timeline vía navegación cliente, sin
    // recarga dura del navegador (FR-019).
    await page.getByRole("link", { name: "Agregar hito" }).click()
    await page.waitForURL(/\/hitos\/nuevo$/)
    await page.getByLabel("Título").fill("Primera vacuna E2E")
    await page.getByRole("button", { name: "Guardar" }).click()
    await page.waitForURL(new RegExp(`/mascotas/${createdSlug}$`))
    await expect(page.getByText("Primera vacuna E2E")).toBeVisible()

    // Cerrar sesión: los controles de admin desaparecen sin necesitar sesión
    // nueva para verlo.
    await page.getByRole("button", { name: "Cerrar sesión" }).click()
    await page.waitForURL("/")
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Dar de alta" })).toHaveCount(0)
  })
})
