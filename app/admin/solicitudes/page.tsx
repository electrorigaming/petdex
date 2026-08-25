import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getPendingRequests, getActiveUsuarios } from "@/lib/account-requests"
import { PendingRequestsList } from "@/components/account-requests/pending-requests-list"
import { ActiveUsersList } from "@/components/account-requests/active-users-list"

// Chequeo temprano de buen mensaje, no la garantía real (Principio I): sin
// sesión admin, is_admin() da false y esto redirige — pero aunque alguien se
// saltee este chequeo, ninguna de las dos listas de abajo traería nada útil
// (RLS: account_requests/app_users solo son legibles por admin o por la
// propia fila) y las Server Actions de aprobar/rechazar/revocar igual
// rechazarían la escritura.
export default async function AdminSolicitudesPage() {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc("is_admin")
  if (!isAdmin) {
    redirect("/")
  }

  const [pending, activeUsuarios] = await Promise.all([getPendingRequests(), getActiveUsuarios()])

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-8 px-4 py-6 md:px-14">
      <div>
        <h3 className="text-h3 text-text">Solicitudes de cuenta</h3>
        <p className="mt-1 text-meta text-text-secondary">
          Aprobá o rechazá pedidos de acceso, y gestioná las cuentas Usuario ya activas.
        </p>
      </div>
      <PendingRequestsList requests={pending} />
      <ActiveUsersList usuarios={activeUsuarios} />
    </main>
  )
}
