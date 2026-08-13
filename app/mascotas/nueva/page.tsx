import { PetForm } from "@/components/pets/pet-form"

export default function NewPetPage() {
  return (
    <main className="mx-auto max-w-[1040px] px-4 py-6 md:px-14">
      <PetForm mode="create" />
    </main>
  )
}
