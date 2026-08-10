import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database"

const PROTECTED_PATTERNS = [
  /^\/mascotas\/nueva$/,
  /^\/mascotas\/[^/]+\/editar$/,
  /^\/mascotas\/[^/]+\/hitos\/.*/,
]

function isProtectedRoute(pathname: string) {
  return PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname))
}

export async function updateSession(request: NextRequest) {
  // Se crea acá y se devuelve al final (o se le copian las cookies a
  // cualquier response construido después) — nunca un NextResponse "limpio"
  // sin estas cookies. Romper esto hace que la sesión expire sola cada hora
  // de forma intermitente (un bug que no se reproduce en desarrollo).
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() valida el token contra el servidor de Auth de Supabase;
  // getSession() solo lee la cookie tal como la mandó el cliente, sin
  // validarla. Usar getSession() acá creería que hay sesión cuando en
  // realidad el token pudo haber sido revocado o nunca fue válido.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtectedRoute(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", request.nextUrl.pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  return response
}
