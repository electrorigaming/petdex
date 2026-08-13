"use client"

// Única suscripción a supabase.auth.getSession() + onAuthStateChange de toda
// la app (research.md §1) — evita que cada componente que necesita saber si
// hay sesión abra la suya propia. `isAdmin` se resuelve con rpc("is_admin") —
// no es una política duplicada en el cliente (Principio I, CLAUDE.md): es la
// misma función `is_admin()` que ya usan las políticas RLS, expuesta como RPC
// de solo lectura (`grant execute ... to authenticated`, petdex-schema.sql).
// La garantía de escritura sigue siendo la política; esto solo decide qué
// mostrar (<AdminGate>).

import { createContext, useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type SessionContextValue = {
  isAuthenticated: boolean
  isAdmin: boolean
  email: string | null
  loading: boolean
}

export const SessionContext = createContext<SessionContextValue>({
  isAuthenticated: false,
  isAdmin: false,
  email: null,
  loading: true,
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
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
          setIsAdmin(false)
          setLoading(false)
        }
        return
      }

      const { data } = await supabase.rpc("is_admin")
      if (!cancelled) {
        setIsAdmin(data ?? false)
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

  return (
    <SessionContext.Provider value={{ isAuthenticated, isAdmin, email, loading }}>
      {children}
    </SessionContext.Provider>
  )
}
