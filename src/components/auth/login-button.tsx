"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

function isSafeRelativePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//")
}

export function LoginButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    const safeNext = next && isSafeRelativePath(next) ? next : "/"
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    })

    if (authError) {
      setError("No se pudo iniciar el proceso de inicio de sesión. Intentá de nuevo.")
      setLoading(false)
    }
    // En éxito, el navegador redirige a Google — no hay nada más que hacer acá.
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={handleClick} disabled={loading} className="w-full">
        {loading ? "Redirigiendo…" : "Continuar con Google"}
      </Button>
      {error && (
        <p role="alert" className="text-label text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
