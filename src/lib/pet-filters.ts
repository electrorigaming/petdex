import type { PetStatus, PetSummary } from "@/lib/pets"

export type PetFilters = {
  estado: PetStatus[]
  esterilizado: boolean[]
}

export const EMPTY_PET_FILTERS: PetFilters = { estado: [], esterilizado: [] }

// Grupo vacío = sin filtrar por ese grupo (spec.md FR-008), nunca "sin
// resultados". Dentro de un grupo los chips se combinan con OR; entre grupos
// distintos, con AND (spec.md FR-006/FR-007).
export function matchesFilters(pet: PetSummary, filters: PetFilters): boolean {
  const matchesEstado = filters.estado.length === 0 || filters.estado.includes(pet.status)
  const matchesEsterilizado =
    filters.esterilizado.length === 0 || filters.esterilizado.includes(pet.sterilized)
  return matchesEstado && matchesEsterilizado
}

export function countActiveFilters(filters: PetFilters): number {
  return filters.estado.length + filters.esterilizado.length
}
