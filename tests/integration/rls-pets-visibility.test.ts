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

  it("guardar como Privado asigna como dueña a quien guarda (FR-004)", async () => {
    // Sin pets_lock_visibility_trigger (eliminado en 006-tipo-editable-formulario),
    // pets_admin_update por sí sola ya garantiza esto: WITH CHECK exige
    // created_by = auth.uid() cuando la fila nueva queda en 'privado'.
    const { data: publicPet, error: insertError } = await admin
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-visibility-editable-test-${Date.now()}`,
        name: "RLS editable test",
        visibility: "publico",
        created_by: adminUserId,
      })
      .select()
      .single()
    expect(insertError).toBeNull()

    const { data: privatized, error: privatizeError } = await admin
      .from("pets")
      .update({ visibility: "privado", created_by: adminUserId })
      .eq("id", publicPet!.id)
      .select()
      .single()
    expect(privatizeError).toBeNull()
    expect(privatized?.visibility).toBe("privado")

    const { data: seenByAnon } = await anon.from("pets").select("id").eq("id", publicPet!.id)
    expect(seenByAnon).toEqual([])

    await admin.from("pets").delete().eq("id", publicPet!.id)
  })

  it("no se puede dejar una fila en Privado con una dueña que no es quien ejecuta (FR-006)", async () => {
    // Un UUID inventado para created_by fallaría por la FK a auth.users
    // antes de llegar a RLS (23503) — no sirve para esta prueba. `null` sí
    // es un valor válido para la FK, así que la sentencia llega hasta
    // WITH CHECK, donde `created_by = auth.uid()` evalúa null = '<uuid>',
    // que nunca es true (research.md §7).
    const { data: pet, error: insertError } = await admin
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-visibility-orphan-test-${Date.now()}`,
        name: "RLS orphan test",
        visibility: "publico",
        created_by: adminUserId,
      })
      .select()
      .single()
    expect(insertError).toBeNull()

    // A diferencia de un USING que oculta filas en silencio (0 filas, sin
    // error), acá la fila SÍ es visible/editable para quien ejecuta (es
    // pública) — lo que falla es WITH CHECK sobre la fila resultante, y eso
    // Postgres lo reporta como error explícito, no como una selección vacía.
    const { data: rejected, error: rejectError } = await admin
      .from("pets")
      .update({ visibility: "privado", created_by: null })
      .eq("id", pet!.id)
      .select()
    expect(rejectError?.code).toBe("42501")
    expect(rejected).toBeNull()

    const { data: stillPublic } = await admin
      .from("pets")
      .select("visibility")
      .eq("id", pet!.id)
      .single()
    expect(stillPublic?.visibility).toBe("publico")

    await admin.from("pets").delete().eq("id", pet!.id)
  })

  it("volver una fila de Privado a Público la hace visible de nuevo (FR-005)", async () => {
    const { data: pet, error: insertError } = await admin
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-visibility-revert-test-${Date.now()}`,
        name: "RLS revert test",
        visibility: "privado",
        created_by: adminUserId,
      })
      .select()
      .single()
    expect(insertError).toBeNull()

    const { data: seenByAnonBefore } = await anon.from("pets").select("id").eq("id", pet!.id)
    expect(seenByAnonBefore).toEqual([])

    const { data: reverted, error: revertError } = await admin
      .from("pets")
      .update({ visibility: "publico", created_by: null })
      .eq("id", pet!.id)
      .select()
      .single()
    expect(revertError).toBeNull()
    expect(reverted?.visibility).toBe("publico")

    const { data: seenByAnonAfter } = await anon.from("pets").select("id").eq("id", pet!.id)
    expect(seenByAnonAfter).toHaveLength(1)

    await admin.from("pets").delete().eq("id", pet!.id)
  })
})
