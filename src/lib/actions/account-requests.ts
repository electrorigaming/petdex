"use server"

// Archivo separado de src/lib/account-requests.ts a propósito: mismo motivo
// que src/lib/actions/milestones.ts — Next.js no permite una Server Action
// inline en un módulo que un Client Component también importa por un export
// sincrónico.

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { mapPostgresError } from "@/lib/errors"
import { accountRequestSchema, type AccountRequestValues } from "@/lib/validation/account-request-schema"

type ActionResult = { ok: true } | { ok: false; message: string }

// Sin sesión requerida — es el camino público de /login (FR-017). El
// `honeypot` es un campo oculto en el formulario, no en el esquema: si llega
// con contenido, se descarta el envío en silencio antes de tocar la base
// (no es una garantía de seguridad, solo reduce ruido de bots simples — la
// garantía real sigue siendo la policy de account_requests_public_insert).
export async function submitAccountRequest(
  input: AccountRequestValues,
  honeypot?: string
): Promise<ActionResult> {
  if (honeypot) {
    return { ok: true }
  }

  const parsed = accountRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  }
  const values = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from("account_requests").insert({
    email: values.email,
    display_name: values.displayName,
  })

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Ya hay una solicitud pendiente con ese email." }
    }
    return { ok: false, message: mapPostgresError(error) }
  }

  return { ok: true }
}

async function requireAdminSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function approveRequest(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdminSession()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { error, count } = await supabase
    .from("account_requests")
    .update({ status: "aprobada", reviewed_by: user.id, reviewed_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)

  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }
  if (count === 0) {
    return { ok: false, message: "No tenés permiso para aprobar esta solicitud." }
  }

  revalidatePath("/admin/solicitudes")
  return { ok: true }
}

export async function rejectRequest(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdminSession()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { error, count } = await supabase
    .from("account_requests")
    .update({ status: "rechazada", reviewed_by: user.id, reviewed_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)

  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }
  if (count === 0) {
    return { ok: false, message: "No tenés permiso para rechazar esta solicitud." }
  }

  revalidatePath("/admin/solicitudes")
  return { ok: true }
}

export async function revokeUsuario(userId: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdminSession()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { error, count } = await supabase
    .from("app_users")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("role", "usuario")

  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }
  if (count === 0) {
    return { ok: false, message: "No tenés permiso para revocar esta cuenta." }
  }

  revalidatePath("/admin/solicitudes")
  return { ok: true }
}
