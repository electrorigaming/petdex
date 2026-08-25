import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Feature 007-roles-y-solicitudes, research.md §5: pet_activity_log se
// llena solo desde triggers security definer — ninguna cuenta, ni siquiera
// admin, tiene una policy de insert/update/delete sobre esta tabla.

async function signInAdmin() {
  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await admin.auth.signInWithPassword({
    email: process.env.TEST_ADMIN_EMAIL!,
    password: process.env.TEST_ADMIN_PASSWORD!,
  })
  return admin
}

describe("RLS: pet_activity_log", () => {
  it("los triggers registran creación de mascota, hito y avistamiento", async () => {
    const admin = await signInAdmin()
    const petId = crypto.randomUUID()
    const { error: petError } = await admin
      .from("pets")
      .insert({ id: petId, slug: `rls-activity-log-${Date.now()}`, name: "Con historial" })
    if (petError) throw petError

    const { data: milestone, error: milestoneError } = await admin
      .from("milestones")
      .insert({ pet_id: petId, title: "Hito con historial", occurred_on: "2026-01-01" })
      .select()
      .single()
    if (milestoneError) throw milestoneError

    await admin.rpc("mark_sighting", { p_pet_id: petId, p_seen: true, p_date: "2026-01-02" })

    const { data: log, error: logError } = await admin
      .from("pet_activity_log")
      .select("action, detail")
      .eq("pet_id", petId)
      .order("created_at", { ascending: true })

    expect(logError).toBeNull()
    const actions = (log ?? []).map((row) => row.action)
    expect(actions).toContain("mascota_creada")
    expect(actions).toContain("hito_agregado")
    expect(actions).toContain("avistamiento_marcado")

    await admin.from("milestones").delete().eq("id", milestone.id)
    const { data: logAfterDelete } = await admin
      .from("pet_activity_log")
      .select("action")
      .eq("pet_id", petId)
      .eq("action", "hito_eliminado")
    expect(logAfterDelete?.length).toBe(1)

    await admin.from("pets").delete().eq("id", petId)
    await admin.auth.signOut()
  })

  it("nadie sin sesión admin puede leer el historial", async () => {
    const admin = await signInAdmin()
    const petId = crypto.randomUUID()
    const { error: petError } = await admin
      .from("pets")
      .insert({ id: petId, slug: `rls-activity-log-privacy-${Date.now()}`, name: "Privacidad" })
    if (petError) throw petError
    await admin.auth.signOut()

    const anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: anonLog } = await anon.from("pet_activity_log").select("*").eq("pet_id", petId)
    expect(anonLog).toEqual([])

    const usuario = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await usuario.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    })
    const { data: usuarioLog } = await usuario.from("pet_activity_log").select("*").eq("pet_id", petId)
    expect(usuarioLog).toEqual([])
    await usuario.auth.signOut()

    const admin2 = await signInAdmin()
    await admin2.from("pets").delete().eq("id", petId)
    await admin2.auth.signOut()
  })

  it("ninguna cuenta puede insertar a mano en el historial, ni siquiera admin", async () => {
    const admin = await signInAdmin()
    const petId = crypto.randomUUID()
    const { error: petError } = await admin
      .from("pets")
      .insert({ id: petId, slug: `rls-activity-log-manual-${Date.now()}`, name: "Sin insert manual" })
    if (petError) throw petError

    const { data, error } = await admin
      .from("pet_activity_log")
      .insert({ pet_id: petId, actor_label: "manual", action: "mascota_creada" })
      .select()

    expect(error?.code).toBe("42501")
    expect(data).toBeNull()

    await admin.from("pets").delete().eq("id", petId)
    await admin.auth.signOut()
  })
})
