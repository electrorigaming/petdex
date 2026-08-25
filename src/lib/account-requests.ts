import { createClient } from "@/lib/supabase/server"

export type PendingRequest = {
  id: string
  email: string
  displayName: string
  requestedAt: string
}

export type ActiveUsuario = {
  userId: string
  email: string
  displayName: string
  createdAt: string
}

// Ambas listas se resuelven en el servidor porque la página que las usa
// (app/admin/solicitudes) ya hace su propio chequeo de admin antes de
// renderizar — a diferencia de <ActivityLog>, que vive dentro de una ruta
// pública y por eso pide sus datos desde el cliente.
export async function getPendingRequests(): Promise<PendingRequest[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("account_requests")
    .select("id, email, display_name, requested_at")
    .eq("status", "pendiente")
    .order("requested_at", { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    requestedAt: row.requested_at,
  }))
}

export async function getActiveUsuarios(): Promise<ActiveUsuario[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("app_users")
    .select("user_id, email, display_name, created_at")
    .eq("role", "usuario")
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  }))
}
