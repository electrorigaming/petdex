"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
import { createPet, updatePet } from "@/lib/actions/pets"
import {
  petFieldsSchema,
  PET_STATUS_LABEL,
  PET_OUTCOME_OPTIONS,
  PET_OUTCOME_NONE_LABEL,
  PET_VISIBILITY_OPTIONS,
  PET_VISIBILITY_LABEL,
  PET_GENDER_OPTIONS,
  PET_GENDER_LABEL,
  type PetFormValues,
} from "@/lib/validation/pet-schema"

// petFieldsSchema coerciona registeredOn/weightKg (input crudo del form
// distinto del valor ya parseado) — RHF necesita ambos tipos por separado
// para que el resolver de Zod tipe correctamente entrada vs. salida.
type PetFormInput = z.input<typeof petFieldsSchema>
import { generateSlug } from "@/lib/slug"
import { PhotoField, type PhotoFieldValue } from "@/components/pets/photo-field"
import { SlugField } from "@/components/pets/slug-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Radio } from "@/components/ui/radio"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type PetFormProps =
  | {
      mode: "create"
    }
  | {
      mode: "edit"
      petId: string
      slug: string
      initialValues: PetFormValues
      initialPhotoUrl: string | null
    }

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseNicknames(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function PetForm(props: PetFormProps) {
  const router = useRouter()
  // Generado una sola vez en el cliente: sirve como pets.id (el insert lo
  // provee explícito) y como prefijo de la ruta de Storage antes de que la
  // fila exista (research.md §4).
  const [newPetId] = useState(() => crypto.randomUUID())
  const petId = props.mode === "edit" ? props.petId : newPetId
  const [slugValue, setSlugValue] = useState(props.mode === "edit" ? props.slug : "")
  const [photoUrl, setPhotoUrl] = useState<PhotoFieldValue>(undefined)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [nicknamesText, setNicknamesText] = useState(() =>
    props.mode === "edit" ? props.initialValues.nicknames.join(", ") : ""
  )

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PetFormInput, unknown, PetFormValues>({
    resolver: zodResolver(petFieldsSchema),
    defaultValues:
      props.mode === "edit"
        ? props.initialValues
        : {
            name: "",
            nicknames: [],
            zone: "",
            location: "",
            registeredOn: new Date(),
            ageEstimate: "",
            weightKg: null,
            description: "",
            outcome: null,
            sterilized: false,
            visibility: "publico",
            gender: "desconocido",
          },
  })

  const name = watch("name")

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  function handleCancel() {
    if (isDirty) {
      setShowLeaveConfirm(true)
      return
    }
    router.back()
  }

  function handleNicknamesChange(text: string) {
    setNicknamesText(text)
    setValue("nicknames", parseNicknames(text), { shouldDirty: true })
  }

  async function onSubmit(values: PetFormValues) {
    setSubmitError(null)

    if (props.mode === "create") {
      const finalSlug = slugValue || generateSlug(values.name)
      const result = await createPet({
        id: petId,
        slug: finalSlug,
        ...values,
        photoUrl: photoUrl ?? undefined,
      })
      if (!result.ok) {
        setSubmitError(result.message)
        return
      }
      router.push(`/mascotas/${result.slug}`)
    } else {
      const result = await updatePet(petId, {
        ...values,
        photoUrl,
      })
      if (!result.ok) {
        setSubmitError(result.message)
        return
      }
      router.push(`/mascotas/${result.slug}`)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h3 className="text-h3 text-text">
          {props.mode === "edit" ? `Editar a ${props.initialValues.name}` : "Agregar una mascota"}
        </h3>
        <p className="mt-1 text-meta text-text-secondary">Los campos vacíos no se muestran en la ficha.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:gap-10">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...register("name")} aria-invalid={Boolean(errors.name)} />
              {errors.name && (
                <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-meta text-accent-text">
                  <WarningIcon size={14} aria-hidden="true" />
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="field">
              <Label htmlFor="nicknames">
                Apodos <span className="text-text-tertiary">· separados por coma</span>
              </Label>
              <Input
                id="nicknames"
                value={nicknamesText}
                onChange={(e) => handleNicknamesChange(e.target.value)}
                placeholder="la tricolor, la de la fuente"
              />
            </div>
          </div>

          <SlugField
            mode={props.mode}
            name={name}
            value={slugValue}
            onChange={setSlugValue}
            currentPetId={props.mode === "edit" ? props.petId : undefined}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <Label htmlFor="zone">Zona</Label>
              <Input id="zone" {...register("zone")} />
            </div>
            <div className="field">
              <Label htmlFor="location">Ubicación exacta</Label>
              <Input id="location" {...register("location")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="field">
              <Label htmlFor="registeredOn">En el registro desde</Label>
              <Controller
                control={control}
                name="registeredOn"
                render={({ field }) => (
                  <Input
                    id="registeredOn"
                    type="date"
                    value={
                      field.value
                        ? toDateInputValue(new Date(field.value as string | number | Date))
                        : ""
                    }
                    onChange={(e) => field.onChange(new Date(e.target.value))}
                  />
                )}
              />
            </div>
            <div className="field">
              <Label htmlFor="ageEstimate">Edad estimada</Label>
              <Input id="ageEstimate" placeholder="texto libre" {...register("ageEstimate")} />
            </div>
            <div className="field">
              <Label htmlFor="weightKg">Peso</Label>
              <Input
                id="weightKg"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                {...register("weightKg")}
                aria-invalid={Boolean(errors.weightKg)}
              />
              {errors.weightKg && (
                <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-meta text-accent-text">
                  <WarningIcon size={14} aria-hidden="true" />
                  El peso tiene que ser un número mayor a cero.
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <Label>Estado</Label>
            {/* Activo/Desaparecido ya no se eligen acá: los calcula
                pets_overview según los últimos avistamientos (migración
                20260817120000). Solo el desenlace queda a mano, y solo
                gana por sobre ese cálculo si no es "Ninguno". */}
            <Controller
              control={control}
              name="outcome"
              render={({ field }) => (
                <div className="mt-1.5 flex flex-wrap gap-4">
                  <Radio
                    name="outcome"
                    checked={field.value === null}
                    onChange={() => field.onChange(null)}
                  >
                    {PET_OUTCOME_NONE_LABEL}
                  </Radio>
                  {PET_OUTCOME_OPTIONS.map((outcome) => (
                    <Radio
                      key={outcome}
                      name="outcome"
                      checked={field.value === outcome}
                      onChange={() => field.onChange(outcome)}
                    >
                      {PET_STATUS_LABEL[outcome]}
                    </Radio>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="field">
            <Label>Género</Label>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <div className="mt-1.5 flex flex-wrap gap-4">
                  {PET_GENDER_OPTIONS.map((gender) => (
                    <Radio
                      key={gender}
                      name="gender"
                      checked={field.value === gender}
                      onChange={() => field.onChange(gender)}
                    >
                      {PET_GENDER_LABEL[gender]}
                    </Radio>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="field">
            <Label>Esterilizado</Label>
            <Controller
              control={control}
              name="sterilized"
              render={({ field }) => (
                <div className="mt-1.5 flex flex-wrap gap-4">
                  <Radio
                    name="sterilized"
                    checked={field.value === true}
                    onChange={() => field.onChange(true)}
                  >
                    Sí
                  </Radio>
                  <Radio
                    name="sterilized"
                    checked={field.value === false}
                    onChange={() => field.onChange(false)}
                  >
                    No
                  </Radio>
                </div>
              )}
            />
          </div>

          <div className="field">
            <Label>Tipo</Label>
            <Controller
              control={control}
              name="visibility"
              render={({ field }) => (
                <div className="mt-1.5 flex flex-wrap gap-4">
                  {PET_VISIBILITY_OPTIONS.map((visibility) => (
                    <Radio
                      key={visibility}
                      name="visibility"
                      checked={field.value === visibility}
                      onChange={() => field.onChange(visibility)}
                    >
                      {PET_VISIBILITY_LABEL[visibility]}
                    </Radio>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="field">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" {...register("description")} />
          </div>
        </div>

        <PhotoField
          petId={petId}
          initialPhotoUrl={props.mode === "edit" ? props.initialPhotoUrl : null}
          value={photoUrl}
          onChange={setPhotoUrl}
        />
      </div>

      {submitError && (
        <p role="alert" className="flex items-center gap-1.5 text-meta text-accent-text">
          <WarningIcon size={14} aria-hidden="true" />
          {submitError}
        </p>
      )}

      <div className="divider-fade" />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          <CheckIcon size={15} aria-hidden="true" />
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Descartar cambios?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Hay cambios sin guardar en este formulario. Si salís ahora, se pierden.
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowLeaveConfirm(false)}>
              Seguir editando
            </Button>
            <Button variant="primary" onClick={() => router.back()}>
              Descartar y salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
