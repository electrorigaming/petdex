import path from "node:path"
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const PHOTO_FIXTURE = path.join(__dirname, "fixtures", "pet-photo.png")

// Duplicado deliberado de src/lib/dates.ts (UTC-3 fijo, research.md §2): el
// test corre en el proceso de Playwright (posible otra zona horaria que el
// navegador) y necesita coincidir exactamente con lo que todayLocal() ve en
// la app, no con la hora local del entorno que ejecuta los tests.
function todayLocalForTest(): string {
  const local = new Date(Date.now() - 3 * 3600_000)
  return local.toISOString().slice(0, 10)
}
function addDaysForTest(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

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
    const today = todayLocalForTest()
    // registered_on unos días atrás — de lo contrario ningún día pasado
    // queda dentro de [registered_on, hoy] para probar la corrección de
    // User Story 3 (FR-005).
    const registeredOn = addDaysForTest(today, -3)
    const pastDay = addDaysForTest(today, -1)
    const futureDay = addDaysForTest(today, 1)

    await page.goto("/mascotas/nueva")
    await page.getByLabel("Nombre").fill(petName)
    await page.getByLabel("Fecha de registro").fill(registeredOn)
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

    // Marcar el avistamiento de hoy (User Story 1): tocar "Visto hoy" lo
    // registra; tocar "Revisado y no estaba" sobre el mismo día lo reemplaza
    // en vez de duplicarlo (unique(pet_id, seen_on)). exact: true —
    // <DayCell> del día de hoy queda con aria-label "10 — revisado y no
    // estaba" apenas el calendario refetchea (mismo refreshKey de
    // <PetSightingsSection>) y matchearía por substring sin esto.
    const seenButton = page.getByRole("button", { name: "Visto hoy", exact: true })
    const notThereButton = page.getByRole("button", { name: "Revisado y no estaba", exact: true })

    await seenButton.click()
    await expect(seenButton).toBeEnabled()
    await expect(seenButton).toHaveClass(/bg-primary/)
    // El calendario refleja el marcado en la misma vista, sin recargar
    // (quickstart.md Validación 1).
    await expect(page.getByText("Vistos este mes").locator("..")).toContainText("1")

    await notThereButton.click()
    await expect(notThereButton).toBeEnabled()
    await expect(notThereButton).toHaveClass(/bg-primary/)
    await expect(seenButton).not.toHaveClass(/bg-primary/)

    // Lectura pública (sightings_public_read/pets_public_read, sin sesión) —
    // a propósito no se usa un cliente admin acá: signOut() de supabase-js
    // tiene scope "global" por default y revocaría también la sesión del
    // navegador (misma cuenta que auth.setup.ts ya dejó autenticada).
    const sightingCheck = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: createdPet } = await sightingCheck
      .from("pets")
      .select("id")
      .eq("slug", createdSlug)
      .single()
    const { data: sightingRows, count: sightingCount } = await sightingCheck
      .from("sightings")
      .select("seen", { count: "exact" })
      .eq("pet_id", createdPet!.id)
    expect(sightingCount).toBe(1)
    expect(sightingRows?.[0]?.seen).toBe(false)

    // Corregir un día pasado desde el calendario (User Story 3, FR-014):
    // tocar un día pasado sin registro lo abre en un diálogo; un día futuro
    // no ofrece ninguna acción.
    const futureDayNumber = Number(futureDay.slice(8, 10))
    const futureDayButton = page.getByRole("button", {
      name: new RegExp(`^${futureDayNumber} — `),
    })
    await expect(futureDayButton).toBeDisabled()

    const pastDayNumber = Number(pastDay.slice(8, 10))
    const pastDayButton = page.getByRole("button", { name: new RegExp(`^${pastDayNumber} — `) })
    await expect(pastDayButton).toBeEnabled()
    await pastDayButton.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(`Registrar el ${pastDay}`)).toBeVisible()
    await dialog.getByRole("button", { name: "Visto" }).click()
    await expect(dialog).toBeHidden()

    // El total del mes ahora cuenta el día pasado (visto) — hoy sigue en
    // "revisado y no estaba", que no suma.
    await expect(page.getByText("Vistos este mes").locator("..")).toContainText("1")

    const { data: pastSighting } = await sightingCheck
      .from("sightings")
      .select("seen")
      .eq("pet_id", createdPet!.id)
      .eq("seen_on", pastDay)
      .single()
    expect(pastSighting?.seen).toBe(true)

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
