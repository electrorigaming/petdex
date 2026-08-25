import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const anon = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

let petId: string

describe("RLS: milestones_admin_write", () => {
  beforeAll(async () => {
    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    const { data, error } = await admin
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-milestones-test-${Date.now()}`,
        name: "RLS milestones test",
      })
      .select()
      .single()
    if (error) throw error
    petId = data.id
  })

  afterAll(async () => {
    // El cascade de la FK milestones.pet_id borra también los hitos creados.
    await admin.from("pets").delete().eq("id", petId)
    await admin.auth.signOut()
  })

  it("rechaza un insert en milestones con la anon key", async () => {
    const { data, error } = await anon
      .from("milestones")
      .insert({ pet_id: petId, title: "Hito anónimo", occurred_on: "2026-01-01" })
      .select()

    expect(error?.code).toBe("42501")
    expect(data).toBeNull()
  })

  it("permite un insert en milestones con una sesión admin real", async () => {
    const { data, error } = await admin
      .from("milestones")
      .insert({ pet_id: petId, title: "Primera vacuna", occurred_on: "2026-01-01" })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data?.title).toBe("Primera vacuna")
  })

  it("un update de anon no modifica el hito", async () => {
    const { data: created, error: createError } = await admin
      .from("milestones")
      .insert({ pet_id: petId, title: "Hito a editar", occurred_on: "2026-01-01" })
      .select()
      .single()
    if (createError) throw createError

    // Igual que en rls-pets-write.test.ts: un update cuyo USING oculta la
    // fila a anon no da error, simplemente no encuentra fila que tocar.
    const { data: anonData, error: anonError } = await anon
      .from("milestones")
      .update({ title: "hackeado" })
      .eq("id", created.id)
      .select()
    expect(anonError).toBeNull()
    expect(anonData).toEqual([])

    const { data: check } = await admin
      .from("milestones")
      .select("title")
      .eq("id", created.id)
      .single()
    expect(check?.title).toBe("Hito a editar")

    const { data: updated, error: adminError } = await admin
      .from("milestones")
      .update({ title: "Título corregido" })
      .eq("id", created.id)
      .select()
      .single()
    expect(adminError).toBeNull()
    expect(updated?.title).toBe("Título corregido")
  })

  it("un delete de anon no borra el hito", async () => {
    const { data: created, error: createError } = await admin
      .from("milestones")
      .insert({ pet_id: petId, title: "Hito a borrar", occurred_on: "2026-01-01" })
      .select()
      .single()
    if (createError) throw createError

    const { error: anonError, count: anonCount } = await anon
      .from("milestones")
      .delete({ count: "exact" })
      .eq("id", created.id)
    expect(anonError).toBeNull()
    expect(anonCount).toBe(0)

    const { data: check } = await admin
      .from("milestones")
      .select("id")
      .eq("id", created.id)
      .maybeSingle()
    expect(check).not.toBeNull()

    const { error: adminError, count } = await admin
      .from("milestones")
      .delete({ count: "exact" })
      .eq("id", created.id)
    expect(adminError).toBeNull()
    expect(count).toBe(1)
  })
})

describe("RLS: milestones_editor_write con cuenta Usuario (feature 007)", () => {
  it("permite insert/update/delete a una cuenta Usuario sobre el hito de una mascota pública", async () => {
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    const { data: pet, error: petError } = await admin
      .from("pets")
      .insert({ id: crypto.randomUUID(), slug: `rls-milestones-usuario-${Date.now()}`, name: "RLS milestones usuario" })
      .select()
      .single()
    if (petError) throw petError
    await admin.auth.signOut()

    const usuario = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await usuario.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    })

    const { data: created, error: createError } = await usuario
      .from("milestones")
      .insert({ pet_id: pet.id, title: "Hito de usuario", occurred_on: "2026-01-01" })
      .select()
      .single()
    expect(createError).toBeNull()
    expect(created?.title).toBe("Hito de usuario")

    const { data: updated, error: updateError } = await usuario
      .from("milestones")
      .update({ title: "Hito editado por usuario" })
      .eq("id", created!.id)
      .select()
      .single()
    expect(updateError).toBeNull()
    expect(updated?.title).toBe("Hito editado por usuario")

    const { error: deleteError, count } = await usuario
      .from("milestones")
      .delete({ count: "exact" })
      .eq("id", created!.id)
    expect(deleteError).toBeNull()
    expect(count).toBe(1)

    await usuario.auth.signOut()

    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    await admin.from("pets").delete().eq("id", pet.id)
    await admin.auth.signOut()
  })
})
