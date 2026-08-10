"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, List } from "lucide-react"

type View = "grid" | "list"

const STORAGE_KEY = "petdex:view"

function applyView(view: View) {
  document.documentElement.setAttribute("data-view", view)
  localStorage.setItem(STORAGE_KEY, view)
}

export function ViewToggle() {
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
      className="flex gap-1 rounded-lg border border-border bg-card p-1"
    >
      <button
        type="button"
        aria-pressed={view === "grid"}
        aria-label="Ver como cuadrícula"
        onClick={() => select("grid")}
        className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ${
          view === "grid"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-pressed={view === "list"}
        aria-label="Ver como lista"
        onClick={() => select("list")}
        className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ${
          view === "list"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <List className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}
