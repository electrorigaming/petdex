"use client"

// Pantalla para una cuenta de Google autenticada cuya solicitud de acceso
// (feature 007-roles-y-solicitudes) todavía está pendiente de revisión —
// distinta de <NotAdminScreen>, que es para quien no tiene ninguna
// solicitud o la tuvo rechazada (spec.md FR-025).

import Link from "next/link"
import { HourglassIcon } from "@phosphor-icons/react/dist/ssr/Hourglass"
import { useSession } from "@/hooks/use-session"
import { LogoutButton } from "@/components/auth/logout-button"

export function RequestPendingScreen() {
  const { email } = useSession()

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 px-4 py-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-hairline">
        <HourglassIcon size={24} className="text-text-tertiary" aria-hidden="true" />
      </span>
      <div>
        <h4 className="mb-1.5 text-h4 text-text">Tu solicitud está pendiente</h4>
        <p className="text-body text-text-secondary">
          {email ? (
            <>
              Entraste como <span className="text-text">{email}</span>. Una administradora todavía
              no revisó tu pedido de acceso.
            </>
          ) : (
            "Una administradora todavía no revisó tu pedido de acceso."
          )}{" "}
          Podés seguir mirando el registro sin cuenta mientras tanto.
        </p>
      </div>
      <div className="flex gap-2.5">
        <LogoutButton />
        <Link
          href="/"
          className="inline-flex min-h-[42px] items-center rounded-md px-2 text-label text-accent-text hover:bg-accent/10"
        >
          Ver el registro
        </Link>
      </div>
    </main>
  )
}
