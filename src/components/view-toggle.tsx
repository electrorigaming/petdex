"use client"

import { useEffect, useState } from "react"
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour"
import { RowsIcon } from "@phosphor-icons/react/dist/ssr/Rows"
import { cn } from "@/lib/utils"

type View = "grid" | "list"

const STORAGE_KEY = "petdex:view"

function applyView(view: View) {
  document.documentElement.setAttribute("data-view", view)
  localStorage.setItem(STORAGE_KEY, view)
}

export function ViewToggle({ className }: { className?: string }) {
  const [view, setView] = useState<View>("grid")

  useEffect(() => {
    const current = document.documentElement.dataset.view === "list" ? "list" : "grid"
    setView(current)
  }, [])

  function select(next: View) {
    setView(next)
    applyView(next)
  }

  return (
    <div
      role="group"
      aria-label="Alternar entre cuadrícula y lista"
      className={cn("inline-flex overflow-hidden rounded-md border border-divider", className)}
    >
      <button
        type="button"
        aria-pressed={view === "grid"}
        aria-label="Ver como cuadrícula"
        onClick={() => select("grid")}
        className={cn(
          "flex h-9 w-9 items-center justify-center transition-colors duration-150",
          view === "grid" ? "text-accent shadow-[inset_0_0_0_1px_#9184d9]" : "text-neutral-500 hover:bg-text/[.07]"
        )}
      >
        <SquaresFourIcon size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-pressed={view === "list"}
        aria-label="Ver como lista"
        onClick={() => select("list")}
        className={cn(
          "flex h-9 w-9 items-center justify-center border-l border-divider transition-colors duration-150",
          view === "list" ? "text-accent shadow-[inset_0_0_0_1px_#9184d9]" : "text-neutral-500 hover:bg-text/[.07]"
        )}
      >
        <RowsIcon size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
