import { z } from "zod"

export const PET_STATUS_OPTIONS = ["activo", "sin_ver", "adoptado", "fallecido"] as const

export const PET_STATUS_LABEL: Record<(typeof PET_STATUS_OPTIONS)[number], string> = {
  activo: "Activo",
  sin_ver: "Sin ver",
  adoptado: "Adoptado",
  fallecido: "Fallecido",
}

// Forma para prosa/UI (ficha, tarjetas) — distinta de PET_STATUS_LABEL,
// que son las etiquetas del formulario/filtros.
export const PET_STATUS_DISPLAY_LABEL: Record<(typeof PET_STATUS_OPTIONS)[number], string> = {
  activo: "Activa",
  sin_ver: "Sin ver hace tiempo",
  adoptado: "Adoptada",
  fallecido: "Fallecida",
}

export const PET_VISIBILITY_OPTIONS = ["publico", "privado"] as const

export type PetVisibility = (typeof PET_VISIBILITY_OPTIONS)[number]

export const PET_VISIBILITY_LABEL: Record<PetVisibility, string> = {
  publico: "Público",
  privado: "Privado",
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
  status: z.enum(PET_STATUS_OPTIONS),
  sterilized: z.boolean().default(false),
  visibility: z.enum(PET_VISIBILITY_OPTIONS).default("publico"),
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
