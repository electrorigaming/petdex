"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createMilestone, updateMilestone } from "@/lib/actions/milestones"
import {
  milestoneFieldsSchema,
  MILESTONE_CATEGORY_OPTIONS,
  type MilestoneFormValues,
} from "@/lib/validation/milestone-schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const CATEGORY_LABEL: Record<(typeof MILESTONE_CATEGORY_OPTIONS)[number], string> = {
  salud: "Salud",
  alimentacion: "Alimentación",
  comportamiento: "Comportamiento",
  otro: "Otro",
}

type MilestoneFormInput = z.input<typeof milestoneFieldsSchema>

type MilestoneFormProps =
  | { mode: "create"; petId: string; petSlug: string }
  | { mode: "edit"; milestoneId: string; petSlug: string; initialValues: MilestoneFormValues }

export function MilestoneForm(props: MilestoneFormProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MilestoneFormInput, unknown, MilestoneFormValues>({
    resolver: zodResolver(milestoneFieldsSchema),
    defaultValues:
      props.mode === "edit"
        ? props.initialValues
        : { title: "", occurredOn: new Date(), note: "" },
  })

  async function onSubmit(values: MilestoneFormValues) {
    setSubmitError(null)
    const result =
      props.mode === "create"
        ? await createMilestone(props.petId, props.petSlug, values)
        : await updateMilestone(props.milestoneId, props.petSlug, values)

    if (!result.ok) {
      setSubmitError(result.message)
      return
    }
    router.push(`/mascotas/${props.petSlug}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" {...register("title")} aria-invalid={Boolean(errors.title)} />
        {errors.title && (
          <p role="alert" className="text-label text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="occurredOn">Fecha</Label>
        <Controller
          control={control}
          name="occurredOn"
          render={({ field }) => (
            <Input
              id="occurredOn"
              type="date"
              value={
                field.value
                  ? new Date(field.value as string | number | Date).toISOString().slice(0, 10)
                  : ""
              }
              onChange={(e) => field.onChange(new Date(e.target.value))}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Categoría</Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                {MILESTONE_CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category} value={category}>
                    {CATEGORY_LABEL[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="note">Nota</Label>
        <Textarea id="note" {...register("note")} />
      </div>

      {submitError && (
        <p role="alert" className="text-label text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/mascotas/${props.petSlug}`)}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  )
}
