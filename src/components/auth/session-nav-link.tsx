"use client"

// Client Component sobre useSession() (research.md §1) — el servidor ya no
// decide qué renderizar acá, así que el HTML de /, que monta este
// componente en el header, no varía por sesión (precondición para poder
// cachearlo con el service worker, contracts/service-worker.md).

import Link from "next/link"
import { useSession } from "@/hooks/use-session"
import { LogoutButton } from "@/components/auth/logout-button"

export function SessionNavLink() {
  const { isAuthenticated, loading } = useSession()

  if (loading) return null

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="text-label font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Iniciar sesión
      </Link>
    )
  }

  return <LogoutButton />
}
