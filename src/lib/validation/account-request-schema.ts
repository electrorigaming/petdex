import { z } from "zod"

export const accountRequestSchema = z.object({
  displayName: z.string().trim().min(1, "Decinos cómo te llamás."),
  email: z.string().trim().email("Ese email no parece válido."),
})

export type AccountRequestValues = z.infer<typeof accountRequestSchema>
