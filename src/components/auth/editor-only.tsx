"use client"

import type { ReactNode } from "react"
import { useSession } from "@/hooks/use-session"

// Mismo patrón que <AdminOnly>, pero para acciones que también puede hacer
// una cuenta con rol Usuario (agregar/editar/eliminar hitos, marcar
// avistamientos — feature 007-roles-y-solicitudes). No renderiza nada
// mientras loading es true, para no mostrar un parpadeo de "sin controles"
// antes de confirmar el rol.
export function EditorOnly({ children }: { children: ReactNode }) {
  const { isEditor, loading } = useSession()
  if (loading || !isEditor) return null
  return <>{children}</>
}
