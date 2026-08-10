"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function TestLoginForm({ email, password }: { email?: string; password?: string }) {
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending")

  useEffect(() => {
    if (!email || !password) {
      setStatus("error")
      return
    }
    const supabase = createClient()
    supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
      setStatus(error ? "error" : "ok")
    })
  }, [email, password])

  if (status === "ok") return <p>OK</p>
  if (status === "error") return <p>ERROR</p>
  return <p>Iniciando sesión de prueba…</p>
}
