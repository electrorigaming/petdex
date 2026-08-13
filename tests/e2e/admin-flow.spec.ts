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
    // scope: "local" — sin esto, signOut() revoca la sesión globalmente
    // (default de supabase-js) e invalida la sesión ya guardada en
    // tests/e2e/.auth/admin.json, rompiendo cualquier test que corra
    // después en la misma ejecución (offline-sighting.spec.ts, que reusa
    // ese storageState). Bug real encontrado corriendo la suite completa.
    await admin.auth.signOut({ scope: "local" })
  })

  test("alta con foto, edición con reemplazo, agregar hito, cerrar sesión", async ({ page }) => {
    const today = todayLocalForTest()
    // registered_on unos días atrás — de lo contrario ningún día pasado
    // queda dentro de [registered_on, hoy] para probar la corrección de
    // User Story 3 (FR-005).
    const registeredOn = addDaysForTest(today, -3)
    const pastDay = addDaysForTest(today, -1)
    const futureDay = addDaysForTest(today, 1)

    // Botón "Agregar" (renombrado desde "Dar de alta") en la cuadrícula.
    await page.goto("/")
    await page.getByRole("link", { name: "Agregar" }).click()
    await page.waitForURL("/mascotas/nueva")
    // exact: true — el buscador del header ("Buscar mascota por nombre o
    // apodo") también matchea "Nombre" por substring case-insensitive si no
    // se pide exacto.
    await page.getByLabel("Nombre", { exact: true }).fill(petName)
    await page.getByLabel("En el registro desde").fill(registeredOn)
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

    // Marcar el avistamiento de hoy (User Story 1): tocar "Visto" lo
    // registra; tocar "No Visto" sobre el mismo día lo reemplaza en
    // vez de duplicarlo (unique(pet_id, seen_on)). exact: true — <DayCell>
    // del día de hoy queda con aria-label "10 — revisado y no estaba" apenas
    // el calendario refetchea (mismo refreshKey de <PetSightingsSection>) y
    // matchearía por substring sin esto. aria-pressed (no una clase CSS) es
    // el hook estable para saber cuál de los dos quedó activo (Nocturne: sin
    // una clase "bg-primary" fija, el estado activo se pinta con un tinte
    // condicional).
    const seenButton = page.getByRole("button", { name: "Visto", exact: true })
    const notThereButton = page.getByRole("button", { name: "No Visto", exact: true })

    await seenButton.click()
    await expect(seenButton).toBeEnabled()
    await expect(seenButton).toHaveAttribute("aria-pressed", "true")
    // El calendario refleja el marcado en la misma vista, sin recargar
    // (quickstart.md Validación 1).
    await expect(page.getByText("vistas este mes").locator("..")).toContainText("1")

    await notThereButton.click()
    await expect(notThereButton).toBeEnabled()
    await expect(notThereButton).toHaveAttribute("aria-pressed", "true")
    await expect(seenButton).toHaveAttribute("aria-pressed", "false")

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
    await expect(dialog.getByText("Sin registro. ¿Qué pasó ese día?")).toBeVisible()
    await dialog.getByRole("button", { name: "Visto", exact: true }).click()
    await expect(dialog).toBeHidden()

    // El total del mes ahora cuenta el día pasado (visto) — hoy sigue en
    // "revisado y no estaba", que no suma.
    await expect(page.getByText("vistas este mes").locator("..")).toContainText("1")

    const { data: pastSighting } = await sightingCheck
      .from("sightings")
      .select("seen")
      .eq("pet_id", createdPet!.id)
      .eq("seen_on", pastDay)
      .single()
    expect(pastSighting?.seen).toBe(true)

    // Corregir un día anterior con fecha manual (sin navegar el calendario
    // mes a mes) — un día distinto al ya corregido arriba.
    const manualDay = addDaysForTest(today, -2)
    await page.getByRole("button", { name: "Corregir otro día" }).click()
    const manualDialog = page.getByRole("dialog")
    await expect(manualDialog).toBeVisible()
    await expect(manualDialog.getByText("Corregir otro día", { exact: true })).toBeVisible()
    await manualDialog.getByLabel("Día").fill(manualDay)
    await manualDialog.getByRole("button", { name: "Visto", exact: true }).click()
    await expect(manualDialog).toBeHidden()

    // Ahora dos días "visto" en el mes (pastDay + manualDay).
    await expect(page.getByText("vistas este mes").locator("..")).toContainText("2")

    const { data: manualSighting } = await sightingCheck
      .from("sightings")
      .select("seen")
      .eq("pet_id", createdPet!.id)
      .eq("seen_on", manualDay)
      .single()
    expect(manualSighting?.seen).toBe(true)

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

    // Eliminar la mascota: confirmación requerida, borra en cascada
    // (hitos/avistamientos) y redirige a la cuadrícula. El borrado es
    // inmediato (no diferido: un setTimeout no sobrevive a un reload — bug
    // real encontrado en producción con la primera versión de este patrón),
    // así que ya se puede verificar contra la base apenas se ve la franja.
    await page.getByRole("button", { name: `Eliminar a ${petName}` }).click()
    const deleteDialog = page.getByRole("dialog")
    await expect(deleteDialog).toBeVisible()
    await deleteDialog.getByRole("button", { name: "Sí, eliminar" }).click()
    await page.waitForURL("/")
    await expect(page.getByText(`Se eliminó a ${petName}.`)).toBeVisible()

    const { data: deletedPet } = await sightingCheck
      .from("pets")
      .select("id")
      .eq("slug", createdSlug)
      .maybeSingle()
    expect(deletedPet).toBeNull()

    // Cerrar sesión: los controles de admin desaparecen sin necesitar sesión
    // nueva para verlo.
    await page.getByRole("button", { name: "Cerrar sesión" }).click()
    await page.waitForURL("/")
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Agregar" })).toHaveCount(0)
  })
})

test.describe("Eliminar una mascota: borrado inmediato y Deshacer", () => {
  // Regresión de un bug real en producción: la primera versión de este
  // patrón difería el borrado real 15s con setTimeout para poder mostrar
  // "Deshacer" — un reload (o simplemente cerrar la pestaña) antes de esos
  // 15s mataba el timer sin que el borrado real llegara a pasar nunca,
  // dejando la mascota "a medio borrar" de forma indefinida
  // (delete-undo-context.tsx). Ahora el borrado es inmediato — estos tests
  // verifican que una recarga apenas confirmado NO revive el registro, y
  // que "Deshacer" restaura de verdad desde el servidor.
  async function createAdminClient() {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    return supabase
  }

  async function createTestPet(admin: ReturnType<typeof createClient<Database>>, name: string) {
    const slug = `e2e-delete-${Date.now()}-${Math.round(Math.random() * 1e6)}`
    const { data } = await admin
      .from("pets")
      .insert({ id: crypto.randomUUID(), slug, name })
      .select("id")
      .single()
    return { id: data!.id, slug }
  }

  test("recargar apenas confirmado el borrado no revive la mascota", async ({ page }) => {
    const admin = await createAdminClient()
    const pet = await createTestPet(admin, `E2E Delete Reload ${Date.now()}`)

    try {
      await page.goto(`/mascotas/${pet.slug}`)
      await page.getByRole("button", { name: `Eliminar a` }).click()
      await page.getByRole("dialog").getByRole("button", { name: "Sí, eliminar" }).click()
      await page.waitForURL("/")

      // Recarga inmediata, sin esperar la ventana de 15s de "Deshacer" — el
      // borrado ya tiene que estar firme en el servidor en este punto.
      await page.reload()

      const { data } = await admin.from("pets").select("id").eq("id", pet.id).maybeSingle()
      expect(data).toBeNull()
    } finally {
      await admin.from("pets").delete().eq("id", pet.id)
      await admin.auth.signOut({ scope: "local" })
    }
  })

  test('"Deshacer" restaura la mascota borrada, con sus hitos', async ({ page }) => {
    const admin = await createAdminClient()
    const petName = `E2E Delete Undo ${Date.now()}`
    const pet = await createTestPet(admin, petName)
    await admin.from("milestones").insert({
      pet_id: pet.id,
      title: "Hito de prueba",
      occurred_on: todayLocalForTest(),
    })

    try {
      await page.goto(`/mascotas/${pet.slug}`)
      await page.getByRole("button", { name: `Eliminar a ${petName}` }).click()
      await page.getByRole("dialog").getByRole("button", { name: "Sí, eliminar" }).click()
      await page.waitForURL("/")

      const { data: afterDelete } = await admin
        .from("pets")
        .select("id")
        .eq("id", pet.id)
        .maybeSingle()
      expect(afterDelete).toBeNull()

      await page.getByRole("button", { name: "Deshacer" }).click()
      await page.waitForURL(new RegExp(`/mascotas/${pet.slug}$`))
      await expect(page.getByRole("heading", { name: petName })).toBeVisible()

      const { data: restored } = await admin
        .from("pets")
        .select("id")
        .eq("id", pet.id)
        .maybeSingle()
      expect(restored).not.toBeNull()

      const { count: milestoneCount } = await admin
        .from("milestones")
        .select("id", { count: "exact", head: true })
        .eq("pet_id", pet.id)
      expect(milestoneCount).toBe(1)
    } finally {
      await admin.from("pets").delete().eq("id", pet.id)
      await admin.auth.signOut({ scope: "local" })
    }
  })
})
