import { readFileSync } from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { signInWithRetry } from "./helpers/auth"

// Feature 007-roles-y-solicitudes, research.md §9: sin la verificación de
// dueño por ruta, cualquier cuenta Usuario podría subir/reemplazar/borrar la
// foto de una mascota que no es suya con solo conocer su petId — este
// archivo es la prueba de que esa protección existe.
//
// Sesiones compartidas por todo el describe (beforeAll/afterAll, no un
// sign-in nuevo por test) — mismo motivo que en
// rls-pets-write.test.ts: evitar el rate-limit de sign-ins de Supabase Auth
// ante una corrida completa de la suite.

const fixture = readFileSync(path.resolve(__dirname, "../e2e/fixtures/pet-photo.png"))

describe("RLS: pet_photos_editor_insert/update/delete", () => {
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

  it("una cuenta Usuario sube una foto bajo un petId nuevo (mascota todavía sin crear)", async () => {
    const petId = crypto.randomUUID()
    const objectPath = `${petId}/foto.png`

    const { error } = await usuario.storage
      .from("pet-photos")
      .upload(objectPath, fixture, { contentType: "image/png" })
    expect(error).toBeNull()

    await usuario.storage.from("pet-photos").remove([objectPath])
  })

  it("una cuenta Usuario sube/reemplaza/borra la foto de su propia mascota privada", async () => {
    const petId = crypto.randomUUID()

    const { error: petError } = await usuario
      .from("pets")
      .insert({
        id: petId,
        slug: `rls-usuario-foto-${Date.now()}`,
        name: "Mascota con foto",
        visibility: "privado",
        created_by: usuarioUid,
      })
    if (petError) throw petError

    const objectPath = `${petId}/foto.png`
    const { error: uploadError } = await usuario.storage
      .from("pet-photos")
      .upload(objectPath, fixture, { contentType: "image/png" })
    expect(uploadError).toBeNull()

    const { error: updateError } = await usuario.storage
      .from("pet-photos")
      .update(objectPath, fixture, { contentType: "image/png" })
    expect(updateError).toBeNull()

    const { error: removeError } = await usuario.storage.from("pet-photos").remove([objectPath])
    expect(removeError).toBeNull()

    await usuario.from("pets").delete().eq("id", petId)
  })

  it("una cuenta Usuario no puede subir ni tocar la foto de una mascota pública ajena", async () => {
    const { data: pet, error: petError } = await admin
      .from("pets")
      .insert({ id: crypto.randomUUID(), slug: `rls-usuario-foto-publica-${Date.now()}`, name: "Pública" })
      .select()
      .single()
    if (petError) throw petError

    const objectPath = `${pet.id}/foto-existente.png`
    const { error: adminUploadError } = await admin.storage
      .from("pet-photos")
      .upload(objectPath, fixture, { contentType: "image/png" })
    if (adminUploadError) throw adminUploadError

    const { error: insertError } = await usuario.storage
      .from("pet-photos")
      .upload(`${pet.id}/otra.png`, fixture, { contentType: "image/png" })
    expect(insertError).not.toBeNull()

    const { error: updateError } = await usuario.storage
      .from("pet-photos")
      .update(objectPath, fixture, { contentType: "image/png" })
    expect(updateError).not.toBeNull()

    const { error: removeError, data: removed } = await usuario.storage
      .from("pet-photos")
      .remove([objectPath])
    // remove() no siempre reporta error cuando RLS oculta el objeto — la
    // prueba real es que la lista de borrados queda vacía.
    expect(removeError === null ? removed : []).toEqual([])

    await admin.storage.from("pet-photos").remove([objectPath])
    await admin.from("pets").delete().eq("id", pet.id)
  })

  it("una cuenta Usuario no puede subir ni tocar la foto de la privada de otra cuenta", async () => {
    const {
      data: { user: adminUser },
    } = await admin.auth.getUser()
    const { data: pet, error: petError } = await admin
      .from("pets")
      .insert({
        id: crypto.randomUUID(),
        slug: `rls-usuario-foto-privada-ajena-${Date.now()}`,
        name: "Privada ajena",
        visibility: "privado",
        created_by: adminUser!.id,
      })
      .select()
      .single()
    if (petError) throw petError

    const { error: insertError } = await usuario.storage
      .from("pet-photos")
      .upload(`${pet.id}/otra.png`, fixture, { contentType: "image/png" })
    expect(insertError).not.toBeNull()

    await admin.from("pets").delete().eq("id", pet.id)
  })
})
