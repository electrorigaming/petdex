import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { signInWithRetry } from "./helpers/auth"

function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Sesión de admin compartida por todo el describe (beforeAll/afterAll) —
// mismo motivo que en rls-pets-write.test.ts. `anon` no cuenta para el
// rate-limit de sign-ins: nunca se autentica.
describe("RLS: account_requests", () => {
  let admin: Awaited<ReturnType<typeof signInWithRetry>>["client"]

  beforeAll(async () => {
    ;({ client: admin } = await signInWithRetry(
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!
    ))
  })

  afterAll(async () => {
    await admin.auth.signOut()
  })

  it("anon puede crear una solicitud pendiente, pero no un duplicado mientras esté pendiente", async () => {
    const anon = anonClient()
    const email = `rls-request-${Date.now()}@example.com`

    const { error } = await anon
      .from("account_requests")
      .insert({ email, display_name: "Solicitante de prueba" })
    expect(error).toBeNull()

    const { error: dupError } = await anon
      .from("account_requests")
      .insert({ email, display_name: "Solicitante de prueba" })
    expect(dupError?.code).toBe("23505")

    await admin.from("account_requests").delete().eq("email", email)
  })

  it("anon no puede aprobar/rechazar su propia solicitud", async () => {
    const anon = anonClient()
    const email = `rls-request-noupdate-${Date.now()}@example.com`
    // Sin .select() encadenado: RETURNING de un insert exige policy de
    // select sobre la fila resultante, y anon no tiene ninguna sobre
    // account_requests — mismo motivo por el que submitAccountRequest()
    // tampoco lo encadena (contracts/server-actions.md).
    const { error: createError } = await anon
      .from("account_requests")
      .insert({ email, display_name: "Solicitante" })
    if (createError) throw createError

    const { data: created } = await admin
      .from("account_requests")
      .select("id")
      .eq("email", email)
      .single()

    const { data: updated, error: updateError } = await anon
      .from("account_requests")
      .update({ status: "aprobada" })
      .eq("id", created!.id)
      .select()
    expect(updateError).toBeNull()
    expect(updated).toEqual([])

    const { data: check } = await admin
      .from("account_requests")
      .select("status")
      .eq("id", created!.id)
      .single()
    expect(check?.status).toBe("pendiente")

    await admin.from("account_requests").delete().eq("id", created!.id)
  })

  it("una cuenta admin puede leer y aprobar/rechazar cualquier solicitud", async () => {
    const anon = anonClient()
    const email = `rls-request-admin-${Date.now()}@example.com`
    const { error: createError } = await anon
      .from("account_requests")
      .insert({ email, display_name: "Solicitante" })
    if (createError) throw createError

    const { data: list } = await admin.from("account_requests").select("id").eq("email", email)
    expect(list?.length).toBe(1)
    const createdId = list![0].id

    const {
      data: { user },
    } = await admin.auth.getUser()
    const { data: approved, error: approveError } = await admin
      .from("account_requests")
      .update({ status: "aprobada", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
      .eq("id", createdId)
      .select()
      .single()
    expect(approveError).toBeNull()
    expect(approved?.status).toBe("aprobada")

    await admin.from("account_requests").delete().eq("id", createdId)
  })

  it("una cuenta autenticada ve su propia solicitud por email, aunque no sea admin", async () => {
    const anon = anonClient()
    const { error: createError } = await anon
      .from("account_requests")
      .insert({ email: process.env.TEST_USER_EMAIL!, display_name: "Cuenta de prueba" })

    // Puede que ya exista una solicitud pendiente de una corrida anterior —
    // lo único que importa acá es que la propia cuenta la vea después.
    if (createError && createError.code !== "23505") throw createError

    const { client: usuario } = await signInWithRetry(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!
    )
    const { data: ownRequest } = await usuario
      .from("account_requests")
      .select("email")
      .eq("email", process.env.TEST_USER_EMAIL!)
    expect(ownRequest?.length).toBeGreaterThan(0)
    await usuario.auth.signOut()

    await admin.from("account_requests").delete().eq("email", process.env.TEST_USER_EMAIL!)
  })
})
