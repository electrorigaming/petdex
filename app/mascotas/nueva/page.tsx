import { PetForm } from "@/components/pets/pet-form"

export default function NewPetPage() {
  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6 md:px-6">
      <h1 className="mb-6 text-h1 text-foreground">Dar de alta una mascota</h1>
      <PetForm mode="create" />
    </main>
  )
}
