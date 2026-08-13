import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Duplicado deliberado de src/lib/dates.ts (mismo motivo que admin-flow.spec.ts:
// el test corre en el proceso de Playwright, no en el navegador).
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

async function signInAsAdmin() {
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
  const slug = `e2e-offline-${Date.now()}-${Math.round(Math.random() * 1e6)}`
  const registeredOn = addDaysForTest(todayLocalForTest(), -3)
  const { data } = await admin
    .from("pets")
    .insert({ id: crypto.randomUUID(), slug, name, registered_on: registeredOn })
    .select("id")
    .single()
  return { id: data!.id, slug }
}

test.describe("Marcado offline y sincronización (User Story 5)", () => {
  // No hay service worker en `next dev` (deshabilitado a propósito, ver
  // next.config.ts) — a diferencia de una prueba manual, este test nunca
  // recarga la página ni navega mientras `context.setOffline(true)` está
  // activo: nada quedaría cacheado para servir esa navegación. La
  // verificación de "qué quedó guardado" se hace contra Supabase
  // directamente, y los cambios de pantalla ocurren siempre con conexión
  // (research.md §7 adaptado a la ausencia de SW en desarrollo).

  test("marcar sin conexión queda pendiente y se confirma solo al reconectar, con la fecha del momento de marcar", async ({
    page,
    context,
  }) => {
    const admin = await signInAsAdmin()
    const pet = await createTestPet(admin, `E2E Offline ${Date.now()}`)
    const today = todayLocalForTest()

    try {
      await page.goto(`/mascotas/${pet.slug}`)
      const seenButton = page.getByRole("button", { name: "Visto", exact: true })
      await expect(seenButton).toBeVisible({ timeout: 30000 })

      await context.setOffline(true)
      await seenButton.click()

      // Feedback optimista (research.md §8): el botón queda marcado y el
      // badge de "pendiente" aparece de inmediato, sin esperar red.
      await expect(page.getByText("Marcada hoy sin conexión")).toBeVisible()
      await expect(seenButton).toHaveAttribute("aria-pressed", "true")

      await context.setOffline(false)

      // Sin recargar la página — el disparador es el evento `online`
      // (contracts/offline-queue.md).
      await expect(page.getByText("Marcada hoy sin conexión")).toHaveCount(0, { timeout: 10000 })
      await expect(seenButton).toHaveAttribute("aria-pressed", "true")

      // El día de hoy en el calendario pasa a "visto" sin el badge de
      // pendiente — no solo el control de marcado. Sin el refetch disparado
      // por `sighting-confirmed` (<PetSightingsSection>), `rows` seguiría sin
      // la fila de hoy (cargada antes del sync) y, en cuanto
      // usePendingSighting vuelve a null, projectMonth() mostraría "sin
      // registro" en vez de "visto" hasta la próxima navegación de mes.
      const todayDayNumber = Number(today.slice(8, 10))
      const todayCell = page.getByRole("button", { name: new RegExp(`^${todayDayNumber} — `) })
      await expect(todayCell).toHaveAccessibleName(`${todayDayNumber} — visto`)

      const { data: sighting } = await admin
        .from("sightings")
        .select("seen, seen_on")
        .eq("pet_id", pet.id)
        .eq("seen_on", today)
        .maybeSingle()
      expect(sighting?.seen).toBe(true)
      expect(sighting?.seen_on).toBe(today)

      const { count } = await admin
        .from("sightings")
        .select("id", { count: "exact", head: true })
        .eq("pet_id", pet.id)
      expect(count).toBe(1)
    } finally {
      await admin.from("pets").delete().eq("id", pet.id)
      await admin.auth.signOut({ scope: "local" })
    }
  })

  test("dos marcados offline seguidos, eligiendo estados distintos: al sincronizar solo queda el último valor", async ({
    page,
    context,
  }) => {
    const admin = await signInAsAdmin()
    const pet = await createTestPet(admin, `E2E Offline Dedup ${Date.now()}`)

    try {
      await page.goto(`/mascotas/${pet.slug}`)
      const seenButton = page.getByRole("button", { name: "Visto", exact: true })
      const notThereButton = page.getByRole("button", {
        name: "No Visto",
        exact: true,
      })
      await expect(seenButton).toBeVisible({ timeout: 30000 })

      await context.setOffline(true)
      await seenButton.click()
      await expect(page.getByText("Marcada hoy sin conexión")).toBeVisible()
      await notThereButton.click()
      await expect(notThereButton).toHaveAttribute("aria-pressed", "true")

      await context.setOffline(false)
      await expect(page.getByText("Marcada hoy sin conexión")).toHaveCount(0, { timeout: 10000 })

      const { data: rows, count } = await admin
        .from("sightings")
        .select("seen", { count: "exact" })
        .eq("pet_id", pet.id)
      expect(count).toBe(1)
      expect(rows?.[0]?.seen).toBe(false)
    } finally {
      await admin.from("pets").delete().eq("id", pet.id)
      await admin.auth.signOut({ scope: "local" })
    }
  })

  test("una mascota eliminada mientras está offline produce una falla permanente, con aviso global descartable", async ({
    page,
    context,
  }) => {
    const admin = await signInAsAdmin()
    const petName = `E2E Offline FK ${Date.now()}`
    const pet = await createTestPet(admin, petName)

    try {
      await page.goto(`/mascotas/${pet.slug}`)
      const seenButton = page.getByRole("button", { name: "Visto", exact: true })
      await expect(seenButton).toBeVisible({ timeout: 30000 })

      await context.setOffline(true)
      await seenButton.click()
      await expect(page.getByText("Marcada hoy sin conexión")).toBeVisible()

      // Violación de FK (23503) al sincronizar — más determinístico de
      // reproducir en un test automatizado que invalidar la sesión (lo que
      // sugiere quickstart.md Validación 5 para una prueba manual); ambos
      // casos comparten la misma regla de clasificación (research.md §4,
      // "cualquier código ⇒ permanente"). El cliente admin del proceso de
      // Node no está afectado por el `setOffline` del contexto del browser.
      await admin.from("pets").delete().eq("id", pet.id)

      await context.setOffline(false)

      // El aviso es global (<SyncFailureBanner>, montado en app/layout.tsx)
      // — se verifica que sigue visible después de una navegación del lado
      // del cliente (no un reload) a una pantalla distinta de la ficha
      // afectada (quickstart.md Validación 5, paso 3).
      const alert = page.getByRole("alert").filter({ hasText: petName })
      await expect(alert).toBeVisible({ timeout: 10000 })

      await page.getByRole("link", { name: "PetDex" }).click()
      await page.waitForURL("/")
      await expect(alert).toBeVisible()

      await page.getByRole("button", { name: `Descartar aviso de ${petName}` }).click()
      await expect(alert).toHaveCount(0)
    } finally {
      // La mascota ya se borró como parte del escenario — solo queda
      // cerrar la sesión de prueba.
      await admin.auth.signOut({ scope: "local" })
    }
  })
})
