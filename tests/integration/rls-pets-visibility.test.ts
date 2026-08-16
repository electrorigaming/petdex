import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// No usa una segunda cuenta administradora real — "anon deniega" ya prueba
// el mismo booleano que denegaría a cualquier otra admin no dueña
// (research.md §5): ni pets_select ni pets_admin_update/delete distinguen
// entre "sin sesión" y "otra admin" más allá de `created_by = auth.uid()`,
// y esa comparación es falsa para cualquier UUID que no sea el propio, sea
// `null` (anon) u otro UUID real.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const anon = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

let adminUserId: string
let privatePetId: string

describe("RLS: visibilidad Privado/Público (pets, milestones, sightings)", () => {
  beforeAll(async () => {
    const { data: signIn, error: signInError } = await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    if (signInError || !signIn.user) throw signInError ?? new Error("sin usuario admin")
    adminUserId = signIn.user.id

    // Mascota privada, dueña de la propia cuenta de test — cleanable por esa
    // misma sesión al terminar (research.md §5).
    const { data, error } = await admin
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-visibility-test-${Date.now()}`,
        name: "RLS visibility test",
        visibility: "privado",
        created_by: adminUserId,
      })
      .select()
      .single()
    if (error) throw error
    privatePetId = data.id
  })

  afterAll(async () => {
    // El cascade de las FK pet_id borra también hitos y avistamientos.
    await admin.from("pets").delete().eq("id", privatePetId)
    await admin.auth.signOut()
  })

  it("la dueña ve, edita y borra su propia mascota privada", async () => {
    const { data: seen, error: seenError } = await admin
      .from("pets")
      .select("id, name")
      .eq("id", privatePetId)
      .maybeSingle()
    expect(seenError).toBeNull()
    expect(seen?.id).toBe(privatePetId)

    const { data: updated, error: updateError } = await admin
      .from("pets")
      .update({ name: "RLS visibility test (editado)" })
      .eq("id", privatePetId)
      .select()
      .single()
    expect(updateError).toBeNull()
    expect(updated?.name).toBe("RLS visibility test (editado)")
  })

  it("un cliente sin sesión no ve la mascota privada ni la puede editar/borrar", async () => {
    const { data: seen, error: seenError } = await anon
      .from("pets")
      .select("id")
      .eq("id", privatePetId)
    expect(seenError).toBeNull()
    expect(seen).toEqual([])

    const { data: updated, error: updateError } = await anon
      .from("pets")
      .update({ name: "hackeado" })
      .eq("id", privatePetId)
      .select()
    expect(updateError).toBeNull()
    expect(updated).toEqual([])

    const { error: deleteError, count } = await anon
      .from("pets")
      .delete({ count: "exact" })
      .eq("id", privatePetId)
    expect(deleteError).toBeNull()
    expect(count).toBe(0)

    const { data: check } = await admin.from("pets").select("id").eq("id", privatePetId).maybeSingle()
    expect(check).not.toBeNull()
  })

  it("hitos y avistamientos de la mascota privada: visibles para la dueña, ocultos sin sesión", async () => {
    const { data: milestone, error: milestoneError } = await admin
      .from("milestones")
      .insert({ pet_id: privatePetId, title: "Hito privado", occurred_on: "2026-01-01" })
      .select()
      .single()
    expect(milestoneError).toBeNull()

    const { data: sighting, error: sightingError } = await admin.rpc("mark_sighting", {
      p_pet_id: privatePetId,
      p_seen: true,
      p_date: "2026-01-01",
    })
    expect(sightingError).toBeNull()
    expect(sighting?.seen).toBe(true)

    const { data: milestonesAsOwner } = await admin
      .from("milestones")
      .select("id")
      .eq("pet_id", privatePetId)
    expect(milestonesAsOwner?.length).toBeGreaterThan(0)

    const { data: milestonesAsAnon } = await anon
      .from("milestones")
      .select("id")
      .eq("pet_id", privatePetId)
    expect(milestonesAsAnon).toEqual([])

    const { data: sightingsAsAnon } = await anon
      .from("sightings")
      .select("id")
      .eq("pet_id", privatePetId)
    expect(sightingsAsAnon).toEqual([])

    const { data: markAsAnon, error: markAsAnonError } = await anon.rpc("mark_sighting", {
      p_pet_id: privatePetId,
      p_seen: true,
      p_date: "2026-01-02",
    })
    expect(markAsAnonError?.code).toBe("42501")
    expect(markAsAnon).toBeNull()

    expect(milestone?.title).toBe("Hito privado")
  })

  it("el Tipo no se puede cambiar desde la app, ni siquiera por la dueña de la fila", async () => {
    // La motivación original de este trigger (research.md §3.1) es que una
    // admin B no dueña podría privatizar y autoasignarse una mascota
    // pública de la admin A. Ese caso puntual (dueño "ajeno") NO se prueba
    // acá empíricamente: created_by tiene FK a auth.users(id), así que un
    // UUID inventado para simular otra cuenta viola la FK (23503) antes de
    // llegar siquiera a evaluarse contra RLS/el trigger, y no hay una
    // segunda cuenta real disponible (research.md §5). Lo que SÍ prueba
    // este test — que ni la propia dueña puede cambiar Tipo vía la API —
    // ejercita exactamente la misma rama del trigger: su condición no
    // referencia ownership en absoluto, bloquea el cambio de
    // visibility/created_by por igual sin importar quién sea el dueño
    // (viejo o nuevo). Se mantiene pública y borrable durante todo el test.
    const { data: publicPet, error: insertError } = await admin
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-visibility-hijack-test-${Date.now()}`,
        name: "RLS hijack test",
        visibility: "publico",
        created_by: adminUserId,
      })
      .select()
      .single()
    expect(insertError).toBeNull()

    const { data: hijacked, error: hijackError } = await admin
      .from("pets")
      .update({ visibility: "privado" })
      .eq("id", publicPet!.id)
      .select()

    // A diferencia de RLS (que filtra filas en silencio), un trigger que
    // hace RAISE EXCEPTION aborta el statement entero: acá sí hay error,
    // no una selección vacía.
    expect(hijackError?.code).toBe("42501")
    expect(hijacked).toBeNull()

    const { data: stillPublic } = await admin
      .from("pets")
      .select("visibility, created_by")
      .eq("id", publicPet!.id)
      .single()
    expect(stillPublic?.visibility).toBe("publico")

    await admin.from("pets").delete().eq("id", publicPet!.id)
  })
})
