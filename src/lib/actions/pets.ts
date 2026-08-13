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

export async function deletePet(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "Iniciá sesión con una cuenta autorizada para continuar." }
  }

  const { data: existing, error: fetchError } = await supabase
    .from("pets")
    .select("photo_url")
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !existing) {
    return { ok: false, message: mapPostgresError(fetchError) }
  }

  const { error } = await supabase.from("pets").delete().eq("id", id)
  if (error) {
    return { ok: false, message: mapPostgresError(error) }
  }

  // La fila ya se borró (milestones/sightings caen con ella por `on delete
  // cascade`) — recién ahora se borra la foto. Si esto falla, el peor caso es
  // un archivo huérfano en el bucket, nunca una mascota a medio borrar.
  if (existing.photo_url) {
    const path = existing.photo_url.split("/pet-photos/")[1]
    if (path) {
      await supabase.storage.from("pet-photos").remove([path])
    }
  }

  revalidatePath("/")
  return { ok: true }
}
