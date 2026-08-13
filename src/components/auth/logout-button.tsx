"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SignOutIcon } from "@phosphor-icons/react/dist/ssr/SignOut"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function LogoutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  if (iconOnly) {
    return (
      <Button
        variant="secondary"
        size="icon"
        onClick={handleClick}
        disabled={loading}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
      >
        <SignOutIcon size={15} aria-hidden="true" />
      </Button>
    )
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={loading}>
      <SignOutIcon size={15} aria-hidden="true" />
      {loading ? "Cerrando sesión…" : "Cerrar sesión"}
    </Button>
  )
}
