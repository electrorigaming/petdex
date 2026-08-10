import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

async function createTestPetAsAdmin(admin: ReturnType<typeof createClient<Database>>) {
  const slug = `rls-write-test-${Date.now()}`
  const { data, error } = await admin
    .from("pets")
    .insert({ id: crypto.randomUUID(), slug, name: "RLS write test" })
    .select()
    .single()
  if (error) throw error
  return data
}

describe("RLS: pets_admin_write (update/delete)", () => {
  it("un update de anon no modifica la fila", async () => {
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
    // A diferencia de insert (que falla con 42501 vía WITH CHECK), un update
    // cuyo USING oculta la fila a anon no devuelve error: simplemente no
    // encuentra ninguna fila visible para actualizar. La prueba real de que
    // RLS bloqueó la escritura es que la fila sigue sin cambios.
    const { data, error } = await anon
      .from("pets")
      .update({ name: "hackeado" })
      .eq("id", pet.id)
      .select()

    expect(error).toBeNull()
    expect(data).toEqual([])

    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    const { data: check } = await admin.from("pets").select("name").eq("id", pet.id).single()
    expect(check?.name).toBe("RLS write test")

    await admin.from("pets").delete().eq("id", pet.id)
    await admin.auth.signOut()
  })

  it("permite un update en pets con una sesión admin real", async () => {
    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    const pet = await createTestPetAsAdmin(admin)

    const { data, error } = await admin
      .from("pets")
      .update({ name: "Nombre actualizado" })
      .eq("id", pet.id)
      .select()

    expect(error).toBeNull()
    expect(data?.[0]?.name).toBe("Nombre actualizado")

    await admin.from("pets").delete().eq("id", pet.id)
    await admin.auth.signOut()
  })

  it("un delete de anon no borra la fila", async () => {
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
    const { error, count } = await anon.from("pets").delete({ count: "exact" }).eq("id", pet.id)
    expect(error).toBeNull()
    expect(count).toBe(0)

    await admin.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    const { data: check } = await admin.from("pets").select("id").eq("id", pet.id).maybeSingle()
    expect(check).not.toBeNull()

    const { error: cleanupError, count: cleanupCount } = await admin
      .from("pets")
      .delete({ count: "exact" })
      .eq("id", pet.id)
    expect(cleanupError).toBeNull()
    expect(cleanupCount).toBe(1)
    await admin.auth.signOut()
  })
})
