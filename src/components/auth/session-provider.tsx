"use client"

// Única suscripción a supabase.auth.getSession() + onAuthStateChange de toda
// la app (research.md §1) — evita que cada componente que necesita saber si
// hay sesión abra la suya propia. Expone isAuthenticated, no isAdmin: no hay
// forma de saber de antemano si la sesión es admin sin intentar escribir
// (mismo criterio que la feature 002); RLS es quien distingue una cuenta
// autorizada recién al momento de escribir.

import { createContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

type SessionContextValue = {
  isAuthenticated: boolean
  loading: boolean
}

export const SessionContext = createContext<SessionContextValue>({
  isAuthenticated: false,
  loading: true,
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(session !== null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(session !== null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SessionContext.Provider value={{ isAuthenticated, loading }}>
      {children}
    </SessionContext.Provider>
  )
}
