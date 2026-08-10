import { describe, expect, it } from "vitest"
import { normalizeSearchText } from "@/lib/search"

describe("normalizeSearchText", () => {
  it("normaliza mayúsculas y acentos al mismo valor", () => {
    expect(normalizeSearchText("Ñandú")).toBe(normalizeSearchText("nandu"))
  })

  it("ignora mayúsculas simples", () => {
    expect(normalizeSearchText("Firulais")).toBe("firulais")
  })
})
