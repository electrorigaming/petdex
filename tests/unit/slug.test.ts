import { describe, expect, it } from "vitest"
import { generateSlug } from "@/lib/slug"

describe("generateSlug", () => {
  it("convierte un nombre simple a kebab-case", () => {
    expect(generateSlug("Firulais")).toBe("firulais")
  })

  it("quita acentos y la ñ se normaliza a n", () => {
    expect(generateSlug("Ñandú Peludo")).toBe("nandu-peludo")
  })

  it("colapsa espacios múltiples en un solo guion", () => {
    expect(generateSlug("Rocky   el   Grande")).toBe("rocky-el-grande")
  })

  it("quita caracteres especiales", () => {
    expect(generateSlug("¿Michi?! (gato)")).toBe("michi-gato")
  })

  it("recorta guiones al inicio y al final", () => {
    expect(generateSlug("  -Toby- ")).toBe("toby")
  })

  it("devuelve string vacío para un nombre sin caracteres alfanuméricos", () => {
    expect(generateSlug("???")).toBe("")
  })
})
