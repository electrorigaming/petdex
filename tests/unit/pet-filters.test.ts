import { describe, expect, it } from "vitest"
import { matchesFilters, type PetFilters } from "@/lib/pet-filters"
import type { PetSummary } from "@/lib/pets"

function pet(overrides: Partial<PetSummary> = {}): PetSummary {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    slug: "firulais",
    name: "Firulais",
    nicknames: [],
    photoUrl: null,
    zone: null,
    status: "activo",
    sterilized: false,
    visibility: "publico",
    gender: "desconocido",
    seenToday: false,
    todayValue: "sin_registro",
    lastSeenOn: null,
    ...overrides,
  }
}

const NO_FILTERS: PetFilters = { estado: [], esterilizado: [], tipo: [], genero: [] }

describe("matchesFilters", () => {
  it("sin filtros activos, cualquier mascota matchea", () => {
    expect(matchesFilters(pet(), NO_FILTERS)).toBe(true)
  })

  it("filtra por un solo chip de Estado", () => {
    const filters: PetFilters = { estado: ["adoptado"], esterilizado: [], tipo: [], genero: [] }
    expect(matchesFilters(pet({ status: "adoptado" }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "activo" }), filters)).toBe(false)
  })

  it("combina varios chips de Estado con OR", () => {
    const filters: PetFilters = {
      estado: ["activo", "sin_ver"],
      esterilizado: [],
      tipo: [],
      genero: [],
    }
    expect(matchesFilters(pet({ status: "activo" }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "sin_ver" }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "fallecido" }), filters)).toBe(false)
  })

  it("combina Estado y Esterilizado con AND entre grupos", () => {
    const filters: PetFilters = { estado: ["activo"], esterilizado: [true], tipo: [], genero: [] }
    expect(matchesFilters(pet({ status: "activo", sterilized: true }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "activo", sterilized: false }), filters)).toBe(false)
    expect(matchesFilters(pet({ status: "adoptado", sterilized: true }), filters)).toBe(false)
  })

  it("todos los chips de un grupo activos equivale a ninguno activo", () => {
    const filters: PetFilters = { estado: [], esterilizado: [true, false], tipo: [], genero: [] }
    expect(matchesFilters(pet({ sterilized: true }), filters)).toBe(true)
    expect(matchesFilters(pet({ sterilized: false }), filters)).toBe(true)
  })

  it("filtra por un solo chip de Tipo", () => {
    const filters: PetFilters = { estado: [], esterilizado: [], tipo: ["privado"], genero: [] }
    expect(matchesFilters(pet({ visibility: "privado" }), filters)).toBe(true)
    expect(matchesFilters(pet({ visibility: "publico" }), filters)).toBe(false)
  })

  it("los dos chips de Tipo activos equivale a ninguno activo", () => {
    const filters: PetFilters = {
      estado: [],
      esterilizado: [],
      tipo: ["privado", "publico"],
      genero: [],
    }
    expect(matchesFilters(pet({ visibility: "privado" }), filters)).toBe(true)
    expect(matchesFilters(pet({ visibility: "publico" }), filters)).toBe(true)
  })

  it("combina Tipo con Estado con AND entre grupos", () => {
    const filters: PetFilters = {
      estado: ["activo"],
      esterilizado: [],
      tipo: ["privado"],
      genero: [],
    }
    expect(matchesFilters(pet({ status: "activo", visibility: "privado" }), filters)).toBe(true)
    expect(matchesFilters(pet({ status: "activo", visibility: "publico" }), filters)).toBe(false)
    expect(matchesFilters(pet({ status: "adoptado", visibility: "privado" }), filters)).toBe(false)
  })

  it("filtra por un solo chip de Género", () => {
    const filters: PetFilters = { estado: [], esterilizado: [], tipo: [], genero: ["hembra"] }
    expect(matchesFilters(pet({ gender: "hembra" }), filters)).toBe(true)
    expect(matchesFilters(pet({ gender: "macho" }), filters)).toBe(false)
    expect(matchesFilters(pet({ gender: "desconocido" }), filters)).toBe(false)
  })

  it("combina varios chips de Género con OR", () => {
    const filters: PetFilters = {
      estado: [],
      esterilizado: [],
      tipo: [],
      genero: ["macho", "hembra"],
    }
    expect(matchesFilters(pet({ gender: "macho" }), filters)).toBe(true)
    expect(matchesFilters(pet({ gender: "hembra" }), filters)).toBe(true)
    expect(matchesFilters(pet({ gender: "desconocido" }), filters)).toBe(false)
  })
})
