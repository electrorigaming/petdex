import { beforeEach, describe, expect, it } from "vitest"
import {
  enqueueSighting,
  getAllPending,
  getPendingForPet,
  markFailed,
  pendingKey,
  remove,
} from "@/lib/offline/queue"
import { getOfflineDB, STORE_NAME } from "@/lib/offline/db"

// fake-indexeddb/auto (vitest.setup.ts) instala una sola base global para
// todo el proceso de test — sin esto, el dedup y la transición failed→pending
// de abajo pasarían por casualidad, arrastrando entradas de un test al
// siguiente en vez de probar el comportamiento real de enqueueSighting().
beforeEach(async () => {
  const db = await getOfflineDB()
  await db.clear(STORE_NAME)
})

const PET = { petId: "pet-1", petSlug: "firulais", petName: "Firulais" }

describe("cola offline: dedup", () => {
  it("marcar el mismo día dos veces sobrescribe en vez de acumular", async () => {
    await enqueueSighting({ ...PET, seenOn: "2026-08-10", seen: true })
    await enqueueSighting({ ...PET, seenOn: "2026-08-10", seen: false })

    const all = await getAllPending()
    expect(all).toHaveLength(1)
    expect(all[0].seen).toBe(false)
    expect(all[0].status).toBe("pending")
  })

  it("dos días distintos de la misma mascota conviven como dos entradas", async () => {
    await enqueueSighting({ ...PET, seenOn: "2026-08-09", seen: true })
    await enqueueSighting({ ...PET, seenOn: "2026-08-10", seen: true })

    const all = await getAllPending()
    expect(all).toHaveLength(2)
  })
})

describe("cola offline: transición failed → pending", () => {
  it("volver a marcar un día fallido lo deja en pending de nuevo, sin failureReason", async () => {
    await enqueueSighting({ ...PET, seenOn: "2026-08-10", seen: true })
    const key = pendingKey(PET.petId, "2026-08-10")
    await markFailed(key, "No tenés permiso para hacer esto.")

    let entry = await getPendingForPet(PET.petId, "2026-08-10")
    expect(entry?.status).toBe("failed")
    expect(entry?.failureReason).toBe("No tenés permiso para hacer esto.")

    await enqueueSighting({ ...PET, seenOn: "2026-08-10", seen: false })

    entry = await getPendingForPet(PET.petId, "2026-08-10")
    expect(entry?.status).toBe("pending")
    expect(entry?.failureReason).toBeNull()
    expect(entry?.seen).toBe(false)
  })
})

describe("cola offline: remove", () => {
  it("descartar una entrada la elimina del store", async () => {
    await enqueueSighting({ ...PET, seenOn: "2026-08-10", seen: true })
    const key = pendingKey(PET.petId, "2026-08-10")

    await remove(key)

    const entry = await getPendingForPet(PET.petId, "2026-08-10")
    expect(entry).toBeNull()
    expect(await getAllPending()).toHaveLength(0)
  })
})
