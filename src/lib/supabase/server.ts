import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"

export async function createClient() {
  // generateStaticParams corre en build time, fuera de un request scope:
  // cookies() no está disponible ahí. Esta feature es de solo lectura
  // pública sin sesión de usuario, así que un cookie store vacío es
  // funcionalmente correcto en ese contexto (research.md no lo cubre
  // porque el problema es de Next.js, no de RLS).
  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null
  try {
    cookieStore = await cookies()
  } catch {
    cookieStore = null
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore?.getAll() ?? []
        },
        setAll(cookiesToSet) {
          if (!cookieStore) return
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Un Server Component no puede escribir cookies — es esperable.
            // El refresco real de la sesión lo hace middleware.ts en cada
            // request; este catch solo evita que un Server Component rompa
            // el render por intentarlo.
          }
        },
      },
    }
  )
}
