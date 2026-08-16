"use server"

// Archivo separado de src/lib/pets.ts a propósito: ver el comentario
// equivalente en src/lib/actions/milestones.ts — Next.js no permite mezclar
// Server Actions inline con exports sincrónicos que un Client Component
// importe del mismo módulo.

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { mapPostgresError } from "@/lib/errors"
import {
  createPetSchema,
  updatePetSchema,
  type CreatePetInput,
  type UpdatePetInput,
} from "@/lib/validation/pet-schema"
import type { WriteResult } from "@/lib/pets"
import type { Database } from "@/types/database"

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function createPet(input: CreatePetInput): Promise<WriteResult> {
  const parsed = createPetSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  }
  const values = parsed.data

  const supabase = await createClient()
  // getUser() da un mensaje temprano y legible; la garantía real es
  // pets_admin_write (RLS), que rechaza igual aunque este chequeo se saltee.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { error } = await supabase.from("pets").insert({
    id: values.id,
    slug: values.slug,
    name: values.name,
    nicknames: values.nicknames,
    zone: values.zone || null,
    location: values.location || null,
    registered_on: toDateString(values.registeredOn),
    age_estimate: values.ageEstimate || null,
    weight_kg: values.weightKg ?? null,
    description: values.description || null,
    status: values.status,
    sterilized: values.sterilized,
    visibility: values.visibility,
    created_by: values.visibility === "privado" ? user.id : null,
    photo_url: values.photoUrl ?? null,
  })

  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }

  revalidatePath("/")
  return { ok: true, slug: values.slug }
}

export async function updatePet(id: string, input: UpdatePetInput): Promise<WriteResult> {
  const parsed = updatePetSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  }
  const values = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { data: existing, error: fetchError } = await supabase
    .from("pets")
    .select("slug, photo_url")
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !existing) {
    return { ok: false, message: mapPostgresError(fetchError) }
  }

  const previousPhotoUrl = existing.photo_url

  const { error } = await supabase
    .from("pets")
    .update({
      name: values.name,
      nicknames: values.nicknames,
      zone: values.zone || null,
      location: values.location || null,
      registered_on: toDateString(values.registeredOn),
      age_estimate: values.ageEstimate || null,
      weight_kg: values.weightKg ?? null,
      description: values.description || null,
      status: values.status,
      sterilized: values.sterilized,
      visibility: values.visibility,
      // Se recalcula en cada guardado a partir de lo que mandó el
      // formulario, sin leer quién era la dueña antes — "privado" siempre
      // pertenece a quien acaba de guardar (spec.md FR-004).
      created_by: values.visibility === "privado" ? user.id : null,
      // undefined = no tocar la foto; string = reemplazo; null = quitarla
      // sin reemplazo (FR-013) — ambos casos actualizan photo_url igual.
      ...(values.photoUrl !== undefined ? { photo_url: values.photoUrl } : {}),
    })
    .eq("id", id)

  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }

  // Orden de operaciones: la fila ya se actualizó con éxito arriba — recién
  // ahora se borra el archivo anterior. Si algo falla acá, el peor caso es
  // un archivo huérfano, nunca una mascota con la foto rota.
  if (values.photoUrl !== undefined && previousPhotoUrl) {
    const previousPath = previousPhotoUrl.split("/pet-photos/")[1]
    if (previousPath) {
      await supabase.storage.from("pet-photos").remove([previousPath])
    }
  }

  revalidatePath("/")
  revalidatePath(`/mascotas/${existing.slug}`, "page")
  return { ok: true, slug: existing.slug }
}

export type PetSnapshot = {
  pet: Database["public"]["Tables"]["pets"]["Row"]
  milestones: Database["public"]["Tables"]["milestones"]["Row"][]
  sightings: Database["public"]["Tables"]["sightings"]["Row"][]
}

// El borrado es inmediato (no diferido en el cliente con setTimeout: eso
// dejaba la mascota "a medio borrar" si se recargaba o navegaba antes de que
// el timer terminara — el timer muere con la pestaña y el borrado real nunca
// llegaba a pasar, bug real reportado en producción). La franja de Deshacer
// (<DeleteUndoProvider>) restaura desde esta copia en vez de cancelar una
// acción pendiente.
export async function deletePet(
  id: string
): Promise<{ ok: true; snapshot: PetSnapshot } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { data: pet, error: fetchError } = await supabase
    .from("pets")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !pet) {
    return { ok: false, message: mapPostgresError(fetchError) }
  }

  const { data: milestones } = await supabase.from("milestones").select("*").eq("pet_id", id)
  const { data: sightings } = await supabase.from("sightings").select("*").eq("pet_id", id)

  const { error } = await supabase.from("pets").delete().eq("id", id)
  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }

  // La foto NO se borra del storage acá a propósito: si se restaura la
  // mascota (Deshacer), la URL pública tiene que seguir sirviendo la misma
  // imagen. El peor caso de no limpiarla es un archivo huérfano en el bucket
  // cuando el borrado queda firme — mismo trade-off ya aceptado en
  // updatePet() para el caso de reemplazo de foto.
  revalidatePath("/")
  return {
    ok: true,
    snapshot: { pet, milestones: milestones ?? [], sightings: sightings ?? [] },
  }
}

export async function restorePet(
  snapshot: PetSnapshot
): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { error: petError } = await supabase.from("pets").insert(snapshot.pet)
  if (petError) {
    return { ok: false, message: mapPostgresError(petError) }
  }

  if (snapshot.milestones.length > 0) {
    const { error } = await supabase.from("milestones").insert(snapshot.milestones)
    if (error) {
      return { ok: false, message: mapPostgresError(error) }
    }
  }

  if (snapshot.sightings.length > 0) {
    const { error } = await supabase.from("sightings").insert(snapshot.sightings)
    if (error) {
      return { ok: false, message: mapPostgresError(error) }
    }
  }

  revalidatePath("/")
  revalidatePath(`/mascotas/${snapshot.pet.slug}`, "page")
  return { ok: true, slug: snapshot.pet.slug }
}
