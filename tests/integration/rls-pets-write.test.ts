import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { signInWithRetry } from "./helpers/auth"

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

// Feature 007-roles-y-solicitudes: el rol Usuario crea/edita/elimina
// únicamente sus propias mascotas Privadas — nunca una Pública, nunca el
// Tipo, nunca una Privada ajena (research.md §8).
//
// Sesiones compartidas por todo el describe (beforeAll/afterAll, no un
// sign-in nuevo por test): Supabase Auth tiene un rate-limit de sign-ins que
// una corrida completa de la suite (varios archivos, cada uno con su propio
// ciclo admin/usuario) alcanza a gatillar si cada test abre su propia sesión
// — confirmado en la práctica (`over_request_rate_limit`, 429). Mismo
// criterio que ya usa `rls-milestones-write.test.ts` para el admin.
describe("RLS: pets_usuario_insert/update/delete_own_private", () => {
  let admin: Awaited<ReturnType<typeof signInWithRetry>>["client"]
  let usuario: Awaited<ReturnType<typeof signInWithRetry>>["client"]
  let usuarioUid: string

  beforeAll(async () => {
    ;({ client: admin } = await signInWithRetry(
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!
    ))
    ;({ client: usuario, uid: usuarioUid } = await signInWithRetry(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!
    ))
  })

  afterAll(async () => {
    await admin.auth.signOut()
    await usuario.auth.signOut()
  })

  it("una cuenta Usuario no puede crear una mascota pública", async () => {
    const { data, error } = await usuario
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-usuario-publica-${Date.now()}`,
        name: "No debería crearse",
        visibility: "publico",
      })
      .select()

    expect(error?.code).toBe("42501")
    expect(data).toBeNull()
  })

  it("una cuenta Usuario crea, edita y elimina su propia mascota privada", async () => {
    const uid = usuarioUid
    const petId = crypto.randomUUID()

    const { data: created, error: createError } = await usuario
      .from("pets")
      .insert({
        id: petId,
        slug: `rls-usuario-privada-${Date.now()}`,
        name: "Mascota de usuario",
        visibility: "privado",
        created_by: uid,
      })
      .select()
      .single()
    expect(createError).toBeNull()
    expect(created?.visibility).toBe("privado")

    const { data: updated, error: updateError } = await usuario
      .from("pets")
      .update({ name: "Mascota de usuario editada" })
      .eq("id", petId)
      .select()
      .single()
    expect(updateError).toBeNull()
    expect(updated?.name).toBe("Mascota de usuario editada")

    // No puede convertirla en pública — la fila vieja pasa USING (así que
    // Postgres sí la toma como candidata), pero la fila nueva no pasa el
    // WITH CHECK de pets_usuario_update_own_private (exige visibility
    // 'privado'), y a diferencia de USING, una fila que falla WITH CHECK
    // produce un error explícito, no un resultado silencioso vacío
    // (research.md §8, nota post-implementación).
    const { data: tipoChange, error: tipoError } = await usuario
      .from("pets")
      .update({ visibility: "publico" })
      .eq("id", petId)
      .select()
    expect(tipoError?.code).toBe("42501")
    expect(tipoChange).toBeNull()

    const { error: deleteError, count } = await usuario
      .from("pets")
      .delete({ count: "exact" })
      .eq("id", petId)
    expect(deleteError).toBeNull()
    expect(count).toBe(1)
  })

  it("reinsertar (simulando restorePet) la propia mascota borrada tiene éxito", async () => {
    const petId = crypto.randomUUID()
    const slug = `rls-usuario-restore-${Date.now()}`

    const { data: created, error: createError } = await usuario
      .from("pets")
      .insert({ id: petId, slug, name: "Para deshacer", visibility: "privado", created_by: usuarioUid })
      .select()
      .single()
    if (createError) throw createError

    await usuario.from("pets").delete().eq("id", petId)

    const { data: restored, error: restoreError } = await usuario
      .from("pets")
      .insert(created!)
      .select()
      .single()
    expect(restoreError).toBeNull()
    expect(restored?.id).toBe(petId)

    await usuario.from("pets").delete().eq("id", petId)
  })

  it("una cuenta Usuario no puede tocar una mascota pública ni la privada de otra cuenta", async () => {
    const { data: publica, error: publicaError } = await admin
      .from("pets")
      .insert({ id: crypto.randomUUID(), slug: `rls-usuario-ajena-publica-${Date.now()}`, name: "Pública ajena" })
      .select()
      .single()
    if (publicaError) throw publicaError

    const {
      data: { user: adminUser },
    } = await admin.auth.getUser()
    const { data: privadaAdmin, error: privadaError } = await admin
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-usuario-ajena-privada-${Date.now()}`,
        name: "Privada de admin",
        visibility: "privado",
        created_by: adminUser!.id,
      })
      .select()
      .single()
    if (privadaError) throw privadaError

    const { data: updatePublica, error: updatePublicaError } = await usuario
      .from("pets")
      .update({ name: "hackeado" })
      .eq("id", publica.id)
      .select()
    expect(updatePublicaError).toBeNull()
    expect(updatePublica).toEqual([])

    const { error: deletePublicaError, count: deletePublicaCount } = await usuario
      .from("pets")
      .delete({ count: "exact" })
      .eq("id", publica.id)
    expect(deletePublicaError).toBeNull()
    expect(deletePublicaCount).toBe(0)

    // privada() ajena: ni siquiera pasa pets_select — invisible antes que
    // cualquier chequeo de escritura.
    const { data: readPrivadaAjena } = await usuario
      .from("pets")
      .select("id")
      .eq("id", privadaAdmin.id)
    expect(readPrivadaAjena).toEqual([])

    const { error: deletePrivadaError, count: deletePrivadaCount } = await usuario
      .from("pets")
      .delete({ count: "exact" })
      .eq("id", privadaAdmin.id)
    expect(deletePrivadaError).toBeNull()
    expect(deletePrivadaCount).toBe(0)

    await admin.from("pets").delete().eq("id", publica.id)
    await admin.from("pets").delete().eq("id", privadaAdmin.id)
  })
})
