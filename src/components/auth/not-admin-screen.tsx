"use client"

// Pantalla de bloqueo para una cuenta de Google autenticada que no está en
// `admins` (login solo restringe con quién funcionan las escrituras vía RLS,
// no con quién puede completar el OAuth de Google — este es el punto donde
// la app lo hace visible). Única acción disponible: cerrar sesión (Nocturne
// 1m, "cuenta sin acceso").

import Link from "next/link"
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit"
import { useSession } from "@/hooks/use-session"
import { LogoutButton } from "@/components/auth/logout-button"

export function NotAdminScreen() {
  const { email } = useSession()

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 px-4 py-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-hairline">
        <ProhibitIcon size={24} className="text-text-tertiary" aria-hidden="true" />
      </span>
      <div>
        <h4 className="mb-1.5 text-h4 text-text">Esta cuenta no tiene acceso</h4>
        <p className="text-body text-text-secondary">
          {email ? (
            <>
              Entraste como <span className="text-text">{email}</span>, pero no está en la
              lista de personas que pueden editar el registro.
            </>
          ) : (
            "Esta cuenta no está en la lista de personas que pueden editar el registro."
          )}{" "}
          Podés seguir mirándolo sin cuenta.
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
      <Link href="/login" className="text-meta text-text-secondary hover:text-text">
        Solicitar una cuenta de Usuario
      </Link>
    </main>
  )
}
