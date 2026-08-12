"use client"

import type { ReactNode } from "react"
import { useSession } from "@/hooks/use-session"

// Reemplaza los `{user && ...}` server-side de las rutas públicas
// (research.md §1). No renderiza nada mientras loading es true, para no
// mostrar un parpadeo de "sin controles" antes de confirmar que
// efectivamente no hay sesión.
export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useSession()
  if (loading || !isAuthenticated) return null
  return <>{children}</>
}
