"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
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
import { RadioChip } from "@/components/ui/radio"

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
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-[420px] flex-col gap-4">
      <div className="field">
        <Label htmlFor="title">Título</Label>
        <Input id="title" {...register("title")} aria-invalid={Boolean(errors.title)} />
        {errors.title && (
          <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-meta text-accent-text">
            <WarningIcon size={14} aria-hidden="true" />
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="field">
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

      <div className="field">
        <Label>Categoría</Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <div className="mt-1.5 flex flex-wrap gap-2">
              <RadioChip
                name="category"
                checked={!field.value}
                onChange={() => field.onChange(null)}
              >
                Sin categoría
              </RadioChip>
              {MILESTONE_CATEGORY_OPTIONS.map((category) => (
                <RadioChip
                  key={category}
                  name="category"
                  checked={field.value === category}
                  onChange={() => field.onChange(category)}
                >
                  {CATEGORY_LABEL[category]}
                </RadioChip>
              ))}
            </div>
          )}
        />
      </div>

      <div className="field">
        <Label htmlFor="note">
          Nota <span className="text-text-tertiary">· opcional</span>
        </Label>
        <Textarea id="note" placeholder="Un par de líneas para el contexto" {...register("note")} />
      </div>

      {submitError && (
        <p role="alert" className="flex items-center gap-1.5 text-meta text-accent-text">
          <WarningIcon size={14} aria-hidden="true" />
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/mascotas/${props.petSlug}`)}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          <CheckIcon size={15} aria-hidden="true" />
          {isSubmitting ? "Guardando…" : "Guardar hito"}
        </Button>
      </div>
      <p className="text-center text-legend text-text-secondary">
        Los hitos son públicos: los ve cualquiera que abra la ficha.
      </p>
    </form>
  )
}
