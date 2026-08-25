import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

async function createTestPetAsAdmin(admin: ReturnType<typeof createClient<Database>>) {
  const slug = `rls-sightings-test-${Date.now()}`
  const { data, error } = await admin
    .from("pets")
    .insert({ id: crypto.randomUUID(), slug, name: "RLS sightings test" })
    .select()
    .single()
  if (error) throw error
  return data
}

describe("RLS: sightings_admin_write (rpc mark_sighting)", () => {
  it("rechaza mark_sighting con la anon key", async () => {
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    const pet = await createTestPetAsAdmin(admin)
    await admin.auth.signOut()

    const anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await anon.rpc("mark_sighting", {
      p_pet_id: pet.id,
      p_seen: true,
      p_date: "2026-08-10",
    })

    // 42501 = insufficient_privilege: confirma que la RLS bloqueó el upsert,
    // no cualquier otro error (key inválida, red, etc.)
    expect(error?.code).toBe("42501")
    expect(data).toBeNull()

    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    await admin.from("pets").delete().eq("id", pet.id)
    await admin.auth.signOut()
  })

  it("permite mark_sighting con una sesión admin real", async () => {
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    const pet = await createTestPetAsAdmin(admin)

    const { data, error } = await admin.rpc("mark_sighting", {
      p_pet_id: pet.id,
      p_seen: true,
      p_date: "2026-08-10",
    })

    expect(error).toBeNull()
    expect(data?.seen).toBe(true)
    expect(data?.seen_on).toBe("2026-08-10")

    // Un segundo llamado sobre el mismo (pet_id, seen_on) hace upsert, no
    // duplica fila (unique(pet_id, seen_on), data-model.md).
    const { data: secondCall, error: secondError } = await admin.rpc("mark_sighting", {
      p_pet_id: pet.id,
      p_seen: false,
      p_date: "2026-08-10",
    })
    expect(secondError).toBeNull()
    expect(secondCall?.seen).toBe(false)

    const { data: rows, count } = await admin
      .from("sightings")
      .select("*", { count: "exact" })
      .eq("pet_id", pet.id)
      .eq("seen_on", "2026-08-10")
    expect(count).toBe(1)
    expect(rows?.[0]?.seen).toBe(false)

    await admin.from("pets").delete().eq("id", pet.id)
    await admin.auth.signOut()
  })
})

describe("RLS: sightings_editor_write con cuenta Usuario (feature 007)", () => {
  it("permite mark_sighting a una cuenta Usuario sobre una mascota pública", async () => {
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    const pet = await createTestPetAsAdmin(admin)
    await admin.auth.signOut()

    const usuario = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await usuario.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    })

    const { data, error } = await usuario.rpc("mark_sighting", {
      p_pet_id: pet.id,
      p_seen: true,
      p_date: "2026-08-11",
    })
    expect(error).toBeNull()
    expect(data?.seen).toBe(true)
    await usuario.auth.signOut()

    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    await admin.from("pets").delete().eq("id", pet.id)
    await admin.auth.signOut()
  })
})
