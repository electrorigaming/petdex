import { Search } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <p className="text-h2 text-card-foreground">
        Todavía no hay mascotas registradas
      </p>
      <p className="text-body text-muted-foreground">
        Cuando se registre la primera, va a aparecer acá.
      </p>
    </div>
  )
}

export function NoResultsState() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Search className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
      <p className="text-h2 text-card-foreground">Sin resultados para tu búsqueda</p>
      <p className="text-body text-muted-foreground">
        Probá con otro nombre, apodo o cambiá el filtro de zona.
      </p>
    </div>
  )
}
