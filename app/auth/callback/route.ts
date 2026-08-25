import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

function isSafeRelativePath(path: string | null): path is string {
  if (!path) return false
  return path.startsWith("/") && !path.startsWith("//")
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next")
  const destination = isSafeRelativePath(next) ? next : "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Enganche del rol Usuario si el email de esta sesión coincide con una
      // solicitud ya aprobada (007-roles-y-solicitudes, research.md §3).
      // Idempotente y sin efecto para cualquier otra cuenta — no bloquea el
      // login si falla, se reintenta solo en el próximo (contracts/server-actions.md).
      await supabase.rpc("claim_approved_account")
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
