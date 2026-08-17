"use client"

import { useState } from "react"
import { GoogleLogoIcon } from "@phosphor-icons/react/dist/ssr/GoogleLogo"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
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
    <div className="flex flex-col gap-2.5">
      <Button variant="secondary" size="block" onClick={handleClick} disabled={loading}>
        <GoogleLogoIcon size={17} aria-hidden="true" />
        {loading ? "Redirigiendo…" : "Continuar con Google"}
      </Button>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-meta text-accent-text">
          <WarningIcon size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
