import { z } from "zod"

// Los 5 valores que puede mostrar la ficha/cuadrícula/filtros — activo y
// sin_ver ya no se cargan a mano, pets_overview los calcula solos según
// los avistamientos (migración 20260817120000). Acá siguen los 5 porque
// esta lista sigue siendo la taxonomía de LECTURA completa.
export const PET_STATUS_OPTIONS = ["activo", "sin_ver", "adoptado", "fallecido", "desconocido"] as const

export const PET_STATUS_LABEL: Record<(typeof PET_STATUS_OPTIONS)[number], string> = {
  activo: "Activo",
  sin_ver: "Desaparecido",
  adoptado: "Adoptado",
  fallecido: "Fallecido",
  desconocido: "Desconocido",
}

// Forma para prosa/UI (ficha, tarjetas) — distinta de PET_STATUS_LABEL,
// que son las etiquetas del formulario/filtros.
export const PET_STATUS_DISPLAY_LABEL: Record<(typeof PET_STATUS_OPTIONS)[number], string> = {
  activo: "Activa",
  sin_ver: "Desaparecida",
  adoptado: "Adoptada",
  fallecido: "Fallecida",
  desconocido: "Desconocida",
}

// Único subconjunto que se sigue cargando a mano, desde el formulario
// (campo "outcome", nunca "status"): un desenlace manual siempre gana por
// sobre lo que digan los avistamientos. Sin desenlace (outcome null), el
// estado mostrado sale de si hubo un avistamiento "visto" en los últimos
// 3 días — ver la migración para el detalle exacto de la regla.
export const PET_OUTCOME_OPTIONS = ["adoptado", "fallecido", "desconocido"] as const

export type PetOutcome = (typeof PET_OUTCOME_OPTIONS)[number] | null

export const PET_OUTCOME_NONE_LABEL = "Por avistamiento"

export const PET_VISIBILITY_OPTIONS = ["publico", "privado"] as const

export type PetVisibility = (typeof PET_VISIBILITY_OPTIONS)[number]

export const PET_VISIBILITY_LABEL: Record<PetVisibility, string> = {
  publico: "Público",
  privado: "Privado",
}

export const PET_GENDER_OPTIONS = ["macho", "hembra", "desconocido"] as const

export type PetGender = (typeof PET_GENDER_OPTIONS)[number]

export const PET_GENDER_LABEL: Record<PetGender, string> = {
  macho: "Macho",
  hembra: "Hembra",
  desconocido: "Desconocido",
}

const nicknameSchema = z.string().trim().min(1)

// Campos comunes a alta y edición. El slug se valida por separado porque en
// edición no viaja en el payload (es de solo lectura, FR-016).
export const petFieldsSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  nicknames: z.array(nicknameSchema).default([]),
  zone: z.string().trim().max(120).optional(),
  location: z.string().trim().max(200).optional(),
  registeredOn: z.coerce.date(),
  ageEstimate: z.string().trim().max(60).optional(),
  // preprocess: un input vacío llega como "" desde el formulario, y
  // Number("") es 0 en JS — sin esto, dejar el campo en blanco fallaría la
  // validación de .positive() en vez de tratarse como "sin dato".
  weightKg: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().positive().max(999.99).optional()
  ).nullable(),
  description: z.string().trim().max(2000).optional(),
  outcome: z.enum(PET_OUTCOME_OPTIONS).nullable().default(null),
  sterilized: z.boolean().default(false),
  visibility: z.enum(PET_VISIBILITY_OPTIONS).default("publico"),
  gender: z.enum(PET_GENDER_OPTIONS).default("desconocido"),
})

export const slugSchema = z
  .string()
  .min(1, "El identificador es obligatorio.")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones.")

export const createPetSchema = petFieldsSchema.extend({
  id: z.string().uuid(),
  slug: slugSchema,
  photoUrl: z.string().url().optional(),
})

export const updatePetSchema = petFieldsSchema.extend({
  photoUrl: z.string().url().nullable().optional(),
})

export type PetFormValues = z.infer<typeof petFieldsSchema>
export type CreatePetInput = z.infer<typeof createPetSchema>
export type UpdatePetInput = z.infer<typeof updatePetSchema>
