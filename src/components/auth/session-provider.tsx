"use client"

// Única suscripción a supabase.auth.getSession() + onAuthStateChange de toda
// la app (research.md §1) — evita que cada componente que necesita saber si
// hay sesión abra la suya propia. `role`/`requestStatus` se resuelven con un
// único rpc("my_account_status") — no es una política duplicada en el
// cliente (Principio I, CLAUDE.md): junta `app_users`/`account_requests` del
// lado del servidor con `security definer`, expuesto como RPC de solo
// lectura (feature 007-roles-y-solicitudes, contracts/database.md).
// `isAdmin`/`isEditor` son derivados de `role`, no otra fuente de verdad. La
// garantía de escritura sigue siendo la política; esto solo decide qué
// mostrar (<AdminGate>).

import { createContext, useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type AppRole = "admin" | "usuario"
type RequestStatus = "pendiente" | "rechazada"

type SessionContextValue = {
  isAuthenticated: boolean
  isAdmin: boolean
  isEditor: boolean
  role: AppRole | null
  requestStatus: RequestStatus | null
  email: string | null
  loading: boolean
}

export const SessionContext = createContext<SessionContextValue>({
  isAuthenticated: false,
  isAdmin: false,
  isEditor: false,
  role: null,
  requestStatus: null,
  email: null,
  loading: true,
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [role, setRole] = useState<AppRole | null>(null)
  const [requestStatus, setRequestStatus] = useState<RequestStatus | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function resolveSession(session: Session | null) {
      setIsAuthenticated(session !== null)
      setEmail(session?.user.email ?? null)

      if (session === null) {
        if (!cancelled) {
          setRole(null)
          setRequestStatus(null)
          setLoading(false)
        }
        return
      }

      const { data } = await supabase.rpc("my_account_status").maybeSingle()
      if (!cancelled) {
        setRole((data?.role as AppRole | null) ?? null)
        setRequestStatus((data?.request_status as RequestStatus | null) ?? null)
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => resolveSession(session))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true)
      resolveSession(session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = role === "admin"
  const isEditor = role === "admin" || role === "usuario"

  return (
    <SessionContext.Provider
      value={{ isAuthenticated, isAdmin, isEditor, role, requestStatus, email, loading }}
    >
      {children}
    </SessionContext.Provider>
  )
}
