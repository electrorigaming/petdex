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
})
