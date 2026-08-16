import type { PetStatus, PetSummary } from "@/lib/pets"
import type { PetGender, PetVisibility } from "@/lib/validation/pet-schema"

export type PetFilters = {
  estado: PetStatus[]
  esterilizado: boolean[]
  tipo: PetVisibility[]
  genero: PetGender[]
}

export const EMPTY_PET_FILTERS: PetFilters = {
  estado: [],
  esterilizado: [],
  tipo: [],
  genero: [],
}

// Grupo vacío = sin filtrar por ese grupo (spec.md FR-008), nunca "sin
// resultados". Dentro de un grupo los chips se combinan con OR; entre grupos
// distintos, con AND (spec.md FR-006/FR-007).
export function matchesFilters(pet: PetSummary, filters: PetFilters): boolean {
  const matchesEstado = filters.estado.length === 0 || filters.estado.includes(pet.status)
  const matchesEsterilizado =
    filters.esterilizado.length === 0 || filters.esterilizado.includes(pet.sterilized)
  const matchesTipo = filters.tipo.length === 0 || filters.tipo.includes(pet.visibility)
  const matchesGenero = filters.genero.length === 0 || filters.genero.includes(pet.gender)
  return matchesEstado && matchesEsterilizado && matchesTipo && matchesGenero
}

export function countActiveFilters(filters: PetFilters): number {
  return (
    filters.estado.length + filters.esterilizado.length + filters.tipo.length + filters.genero.length
  )
}
