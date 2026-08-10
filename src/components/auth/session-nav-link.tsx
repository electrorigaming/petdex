import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { LogoutButton } from "@/components/auth/logout-button"

export async function SessionNavLink() {
  const supabase = await createClient()
  // getUser() valida el token contra el servidor de Auth; getSession() solo
  // leería la cookie sin validarla. Ver src/lib/supabase/middleware.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
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
