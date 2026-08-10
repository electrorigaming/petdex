import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

describe("RLS: pets_admin_write", () => {
  it("rechaza un insert en pets con la anon key", async () => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from("pets")
      .insert({ slug: `rls-test-${Date.now()}`, name: "RLS test" })
      .select()

    // 42501 = insufficient_privilege: confirma que la RLS bloqueó el insert,
    // no cualquier otro error (key inválida, red, etc.)
    expect(error?.code).toBe("42501")
    expect(data).toBeNull()
  })

  it("permite un insert en pets con una sesión admin real", async () => {
    // El admin de prueba es una fila real de `admins`, con los mismos
    // privilegios que cualquier administrador — no es un atajo de la service
    // role key (prohibida sin excepciones, research.md §6).
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    })
    expect(signInError).toBeNull()

    const slug = `rls-test-admin-${Date.now()}`
    const { data, error } = await supabase
      .from("pets")
      .insert({ id: crypto.randomUUID(), slug, name: "RLS test admin" })
      .select()

    expect(error).toBeNull()
    expect(data).not.toBeNull()

    await supabase.from("pets").delete().eq("slug", slug)
    await supabase.auth.signOut()
  })
})
