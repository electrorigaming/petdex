import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { signInWithRetry } from "./helpers/auth"

// Sesión de admin compartida por los tests 1-2 (beforeAll/afterAll) — mismo
// motivo que en rls-pets-write.test.ts: evitar el rate-limit de sign-ins de
// Supabase Auth. El test de claim_approved_account() sigue con su propio
// sign-in puntual (TEST_CLAIM_EMAIL solo tiene sentido "sin reclamar" una
// vez, no se puede compartir entre tests).
describe("RLS: app_users", () => {
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

  it("admin ve todas las filas, una cuenta Usuario solo la propia", async () => {
    const { data: allRows, error: adminError } = await admin.from("app_users").select("user_id")
    expect(adminError).toBeNull()
    expect(allRows!.length).toBeGreaterThanOrEqual(2)

    const { client: usuario } = await signInWithRetry(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!
    )
    const { data: ownRows, error: usuarioError } = await usuario.from("app_users").select("email")
    expect(usuarioError).toBeNull()
    expect(ownRows).toEqual([{ email: process.env.TEST_USER_EMAIL! }])
    await usuario.auth.signOut()
  })

  it("admin puede revocar una cuenta Usuario, pero no a otra administradora", async () => {
    const {
      data: { user: adminUser },
    } = await admin.auth.getUser()

    const { error: revokeAdminError, count: revokeAdminCount } = await admin
      .from("app_users")
      .delete({ count: "exact" })
      .eq("user_id", adminUser!.id)
      .eq("role", "usuario")
    expect(revokeAdminError).toBeNull()
    expect(revokeAdminCount).toBe(0)

    const { data: stillAdmin } = await admin
      .from("app_users")
      .select("role")
      .eq("user_id", adminUser!.id)
      .single()
    expect(stillAdmin?.role).toBe("admin")
  })

  it("claim_approved_account() otorga el rol Usuario recién en el próximo login real", async () => {
    const {
      data: { user: adminUser },
    } = await admin.auth.getUser()

    await admin.from("account_requests").delete().eq("email", process.env.TEST_CLAIM_EMAIL!)
    const { data: request, error: requestError } = await admin
      .from("account_requests")
      .insert({ email: process.env.TEST_CLAIM_EMAIL!, display_name: "Cuenta a reclamar" })
      .select()
      .single()
    if (requestError) throw requestError

    const { error: approveError } = await admin
      .from("account_requests")
      .update({ status: "aprobada", reviewed_by: adminUser!.id, reviewed_at: new Date().toISOString() })
      .eq("id", request.id)
    if (approveError) throw approveError

    const { client: claimant, uid: claimantUid } = await signInWithRetry(
      process.env.TEST_CLAIM_EMAIL!,
      process.env.TEST_CLAIM_PASSWORD!
    )

    const { error: claimError } = await claimant.rpc("claim_approved_account")
    expect(claimError).toBeNull()

    const { data: claimed } = await claimant
      .from("app_users")
      .select("role")
      .eq("user_id", claimantUid)
      .single()
    expect(claimed?.role).toBe("usuario")

    // Idempotente: un segundo llamado no falla ni duplica nada.
    const { error: secondClaimError } = await claimant.rpc("claim_approved_account")
    expect(secondClaimError).toBeNull()

    await claimant.auth.signOut()

    await admin.from("app_users").delete().eq("user_id", claimantUid)
  })
})
