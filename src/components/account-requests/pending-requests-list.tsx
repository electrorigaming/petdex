"use client"

import { useState, useTransition } from "react"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check"
import { XIcon } from "@phosphor-icons/react/dist/ssr/X"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
import { approveRequest, rejectRequest } from "@/lib/actions/account-requests"
import type { PendingRequest } from "@/lib/account-requests"
import { Button } from "@/components/ui/button"

export function PendingRequestsList({ requests }: { requests: PendingRequest[] }) {
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function handle(id: string, action: (id: string) => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action(id)
      if (!result.ok) {
        setErrors((prev) => ({ ...prev, [id]: result.message ?? "Algo salió mal." }))
        return
      }
      setErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setResolved((prev) => new Set(prev).add(id))
    })
  }

  const visible = requests.filter((r) => !resolved.has(r.id))

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-h5 text-text">Pendientes</h4>
      {visible.length === 0 ? (
        <p className="text-caption text-text-secondary">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-2 rounded-md bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-label font-medium text-card-foreground">{request.displayName}</p>
                <p className="text-meta text-text-secondary">{request.email}</p>
                {errors[request.id] && (
                  <p role="alert" className="mt-1 flex items-center gap-1.5 text-meta text-accent-text">
                    <WarningIcon size={13} aria-hidden="true" />
                    {errors[request.id]}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => handle(request.id, approveRequest)}
                >
                  <CheckIcon size={14} aria-hidden="true" />
                  Aprobar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => handle(request.id, rejectRequest)}
                >
                  <XIcon size={14} aria-hidden="true" />
                  Rechazar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
