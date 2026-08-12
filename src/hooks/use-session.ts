"use client"

import { useContext } from "react"
import { SessionContext } from "@/components/auth/session-provider"

export function useSession() {
  return useContext(SessionContext)
}
