import { z } from "zod"

export const MILESTONE_CATEGORY_OPTIONS = [
  "salud",
  "alimentacion",
  "comportamiento",
  "otro",
] as const

export const milestoneFieldsSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio."),
  occurredOn: z.coerce.date(),
  category: z.enum(MILESTONE_CATEGORY_OPTIONS).optional(),
  note: z.string().trim().max(1000).optional(),
})

export type MilestoneFormValues = z.infer<typeof milestoneFieldsSchema>
