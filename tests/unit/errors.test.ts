import { describe, expect, it, vi } from "vitest"
import { mapPostgresError } from "@/lib/errors"

describe("mapPostgresError", () => {
  it("mapea 23505 a mensaje de slug duplicado", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(mapPostgresError({ code: "23505", message: "duplicate key" })).toBe(
      "Ese identificador ya está en uso. Probá con otro."
    )
  })

  it("mapea 42501 a mensaje de permisos", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(mapPostgresError({ code: "42501", message: "insufficient privilege" })).toBe(
      "No tenés permiso para hacer esto. Iniciá sesión con una cuenta autorizada."
    )
  })

  it("mapea un código desconocido a un mensaje genérico", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(mapPostgresError({ code: "99999", message: "???" })).toBe(
      "Algo salió mal. Intentá de nuevo."
    )
  })

  it("mapea un error sin código a un mensaje genérico", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(mapPostgresError(null)).toBe("Algo salió mal. Intentá de nuevo.")
  })

  it("registra el error crudo en consola para diagnóstico", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const error = { code: "42501", message: "insufficient privilege" }
    mapPostgresError(error)
    expect(spy).toHaveBeenCalledWith(error)
  })
})
