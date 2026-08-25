import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Historial de modificaciones (feature 007-roles-y-solicitudes). Solo lo
// llenan los triggers de la migración — nunca se escribe desde acá. Archivo
// separado de src/lib/pets.ts a propósito: ese módulo importa
// src/lib/supabase/server.ts (next/headers) a nivel de archivo, y
// <ActivityLog> (Client Component) necesita estos tipos/función sin
// arrastrar ese import al bundle del cliente — Next.js rechaza el build si
// un Client Component importa, aunque sea transitivamente, algo que use
// next/headers. Recibe el cliente en vez de crear el suyo propio porque
// <ActivityLog> lo pide desde el navegador recién cuando isAdmin es true
// (data-model.md, "Formulario y controles de mascota"): nunca se resuelve
// en el servidor y se pasa como prop, para no filtrar datos admin-only al
// HTML/RSC inicial.
export type ActivityAction =
  | "mascota_creada"
  | "mascota_editada"
  | "hito_agregado"
  | "hito_editado"
  | "hito_eliminado"
  | "avistamiento_marcado"

export type ActivityEvent = {
  id: string
  actorLabel: string
  action: ActivityAction
  detail: string | null
  createdAt: string
}

export const ACTIVITY_ACTION_LABEL: Record<ActivityAction, string> = {
  mascota_creada: "creó la ficha",
  mascota_editada: "editó la ficha",
  hito_agregado: "agregó el hito",
  hito_editado: "editó el hito",
  hito_eliminado: "eliminó el hito",
  avistamiento_marcado: "marcó un avistamiento",
}

export async function getActivityLog(
  supabase: SupabaseClient<Database>,
  petId: string
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("pet_activity_log")
    .select("id, actor_label, action, detail, created_at")
    .eq("pet_id", petId)
    .order("created_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    actorLabel: row.actor_label,
    action: row.action as ActivityAction,
    detail: row.detail,
    createdAt: row.created_at,
  }))
}
