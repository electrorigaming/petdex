import { describe, expect, it } from "vitest"
import { matchesFilters, type PetFilters } from "@/lib/pet-filters"
import type { PetSummary } from "@/lib/pets"

function pet(overrides: Partial<PetSummary> = {}): PetSummary {
  return {
    slug: "firulais",
    name: "Firulais",
    nicknames: [],
    photoUrl: null,
    zone: null,
    status: "activo",
    sterilized: false,
    seenToday: false,
    lastSeenOn: null,
    ...overrides,
  }
}

const NO_FILTERS: PetFilters = { estado: [], esterilizado: [] }

describe("matchesFilters", () => {
  it("sin filtros activos, cualquier mascota matchea", () => {
    expect(matchesFilters(pet(), NO_FILTERS)).toBe(true)
  })

  it("filtra por un solo chip de Estado", () => {
    const filters: PetFilters = { estado: ["adoptado"], esterilizado: [] }
    expect(matchesFilters(pet({ status: "adoptado" }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "activo" }), filters)).toBe(false)
  })

  it("combina varios chips de Estado con OR", () => {
    const filters: PetFilters = { estado: ["activo", "sin_ver"], esterilizado: [] }
    expect(matchesFilters(pet({ status: "activo" }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "sin_ver" }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "fallecido" }), filters)).toBe(false)
  })

  it("combina Estado y Esterilizado con AND entre grupos", () => {
    const filters: PetFilters = { estado: ["activo"], esterilizado: [true] }
    expect(matchesFilters(pet({ status: "activo", sterilized: true }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "activo", sterilized: false }), filters)).toBe(false)
    expect(matchesFilters(pet({ status: "adoptado", sterilized: true }), filters)).toBe(false)
  })

  it("todos los chips de un grupo activos equivale a ninguno activo", () => {
    const filters: PetFilters = { estado: [], esterilizado: [true, false] }
    expect(matchesFilters(pet({ sterilized: true }), filters)).toBe(true)
    expect(matchesFilters(pet({ sterilized: false }), filters)).toBe(true)
  })
})
