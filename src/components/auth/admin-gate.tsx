"use client"

// Reemplaza el contenido de la página por <NotAdminScreen> cuando hay una
// sesión de Google autenticada que no es admin — en vez de dejar pasar a la
// app normal con controles que solo van a fallar al escribir (RLS los
// rechaza igual, pero la experiencia queda confusa). Montado en
// app/layout.tsx envolviendo {children}, así aplica a cualquier ruta.
//
// `children` es el árbol armado por Server Components de cada página, así
// que sí se serializa igual en el HTML/RSC inicial para una cuenta no-admin
// (mismo trade-off que <AdminOnly>, research.md de la feature 003) — pero acá
// no hay filtración real: todo lo que una página pública muestra ya es de
// lectura pública (pets_public_read/sightings_public_read), lo mismo que
// vería sin sesión. El destello inicial se resuelve apenas useSession()
// determina isAdmin.

import type { ReactNode } from "react"
import { useSession } from "@/hooks/use-session"
import { NotAdminScreen } from "@/components/auth/not-admin-screen"
import { RequestPendingScreen } from "@/components/auth/request-pending-screen"

export function AdminGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, isEditor, requestStatus, loading } = useSession()

  if (!loading && isAuthenticated && !isAdmin && !isEditor) {
    if (requestStatus === "pendiente") {
      return <RequestPendingScreen />
    }
    return <NotAdminScreen />
  }

  return <>{children}</>
}
