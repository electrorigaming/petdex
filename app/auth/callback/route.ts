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
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
