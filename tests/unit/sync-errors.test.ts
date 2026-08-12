import { describe, expect, it } from "vitest"
import { classifySyncError } from "@/lib/offline/sync-errors"

describe("classifySyncError", () => {
  it("clasifica como 'permanent' cualquier error con code (rechazo de RLS)", () => {
    expect(classifySyncError({ code: "42501", message: "denegado" })).toBe("permanent")
  })

  it("clasifica como 'permanent' una violación de clave foránea", () => {
    expect(classifySyncError({ code: "23503", message: "fk violation" })).toBe("permanent")
  })

  it("clasifica como 'transient' un error de red sin code (fetch fallido)", () => {
    // Igual a lo que supabase-js resuelve realmente para un host inalcanzable:
    // { data: null, error: { message: "TypeError: fetch failed", code: "" } }
    expect(classifySyncError({ code: "", message: "TypeError: fetch failed" })).toBe("transient")
  })

  it("clasifica como 'transient' un TypeError nativo (sin code)", () => {
    expect(classifySyncError(new TypeError("Failed to fetch"))).toBe("transient")
  })

  it("clasifica como 'transient' un error sin forma reconocida", () => {
    expect(classifySyncError(undefined)).toBe("transient")
    expect(classifySyncError(null)).toBe("transient")
  })
})
