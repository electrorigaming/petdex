"use client"

// Formulario público en /login (FR-017/FR-018) — sin sesión, cualquiera lo
// completa. `honeypot` es un campo de texto oculto vía CSS, nunca mostrado a
// una persona real: si un bot lo completa igual, submitAccountRequest()
// descarta el envío en silencio (research.md, no reemplaza a la policy de
// account_requests_public_insert, solo reduce ruido).

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning"
import { submitAccountRequest } from "@/lib/actions/account-requests"
import { accountRequestSchema, type AccountRequestValues } from "@/lib/validation/account-request-schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AccountRequestForm() {
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountRequestValues>({ resolver: zodResolver(accountRequestSchema) })

  async function onSubmit(values: AccountRequestValues) {
    setSubmitError(null)
    const honeypot = (document.getElementById("account-request-website") as HTMLInputElement | null)
      ?.value
    const result = await submitAccountRequest(values, honeypot)
    if (!result.ok) {
      setSubmitError(result.message)
      return
    }
    setSubmitted(true)
    reset()
  }

  if (submitted) {
    return (
      <p className="flex items-center gap-1.5 rounded-md bg-card px-3 py-2.5 text-meta text-card-foreground">
        <CheckCircleIcon size={16} className="text-accent-text" aria-hidden="true" />
        Listo, tu solicitud quedó registrada. Una administradora la va a revisar.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div>
        <p className="text-label font-medium text-text">¿No tenés cuenta?</p>
        <p className="text-meta text-text-secondary">
          Pedí acceso como Usuario para editar hitos y marcar avistamientos.
        </p>
      </div>
      <div className="field">
        <Label htmlFor="account-request-name">Nombre</Label>
        <Input id="account-request-name" {...register("displayName")} aria-invalid={Boolean(errors.displayName)} />
        {errors.displayName && (
          <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-meta text-accent-text">
            <WarningIcon size={14} aria-hidden="true" />
            {errors.displayName.message}
          </p>
        )}
      </div>
      <div className="field">
        <Label htmlFor="account-request-email">Email</Label>
        <Input
          id="account-request-email"
          type="email"
          {...register("email")}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && (
          <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-meta text-accent-text">
            <WarningIcon size={14} aria-hidden="true" />
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="account-request-website">No completar</label>
        <input id="account-request-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {submitError && (
        <p role="alert" className="flex items-center gap-1.5 text-meta text-accent-text">
          <WarningIcon size={14} aria-hidden="true" />
          {submitError}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Solicitar una cuenta"}
      </Button>
    </form>
  )
}
