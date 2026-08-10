"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X } from "lucide-react"
import { createPet, updatePet } from "@/lib/actions/pets"
import {
  petFieldsSchema,
  PET_STATUS_OPTIONS,
  PET_STATUS_LABEL,
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
            status: "activo",
          },
  })

  const name = watch("name")
  const nicknames = watch("nicknames") ?? []
  const [nicknameDraft, setNicknameDraft] = useState("")

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

  function addNickname() {
    const trimmed = nicknameDraft.trim()
    if (!trimmed) return
    setValue("nicknames", [...nicknames, trimmed], { shouldDirty: true })
    setNicknameDraft("")
  }

  function removeNickname(index: number) {
    setValue(
      "nicknames",
      nicknames.filter((_, i) => i !== index),
      { shouldDirty: true }
    )
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
      <PhotoField
        petId={petId}
        initialPhotoUrl={props.mode === "edit" ? props.initialPhotoUrl : null}
        value={photoUrl}
        onChange={setPhotoUrl}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" {...register("name")} aria-invalid={Boolean(errors.name)} />
        {errors.name && (
          <p role="alert" className="text-label text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <SlugField
        mode={props.mode}
        name={name}
        value={slugValue}
        onChange={setSlugValue}
        currentPetId={props.mode === "edit" ? props.petId : undefined}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname-draft">Apodos</Label>
        <div className="flex gap-2">
          <Input
            id="nickname-draft"
            value={nicknameDraft}
            onChange={(e) => setNicknameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addNickname()
              }
            }}
            placeholder="Agregar un apodo"
          />
          <Button type="button" variant="outline" onClick={addNickname}>
            Agregar
          </Button>
        </div>
        {nicknames.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {nicknames.map((nickname, index) => (
              <li
                key={`${nickname}-${index}`}
                className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-label text-foreground"
              >
                {nickname}
                <button
                  type="button"
                  onClick={() => removeNickname(index)}
                  aria-label={`Quitar apodo ${nickname}`}
                  className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="zone">Zona</Label>
          <Input id="zone" {...register("zone")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">Ubicación de referencia</Label>
          <Input id="location" {...register("location")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="registeredOn">Fecha de registro</Label>
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="ageEstimate">Edad estimada</Label>
          <Input id="ageEstimate" placeholder="Ej: ~2 años" {...register("ageEstimate")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="weightKg">Peso (kg)</Label>
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
            <p role="alert" className="text-label text-destructive">
              El peso tiene que ser un número mayor a cero.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Estado</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PET_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PET_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" {...register("description")} />
      </div>

      {submitError && (
        <p role="alert" className="text-label text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Descartar cambios?</DialogTitle>
            <DialogDescription>
              Hay cambios sin guardar en este formulario. Si salís ahora, se pierden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
              Seguir editando
            </Button>
            <Button variant="default" onClick={() => router.back()}>
              Descartar y salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
