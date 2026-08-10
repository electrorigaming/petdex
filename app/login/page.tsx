import { LoginButton } from "@/components/auth/login-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <p className="text-body text-muted-foreground">
            Solo para cuentas administradoras autorizadas.
          </p>
        </CardHeader>
        <CardContent>
          <LoginButton next={next} />
        </CardContent>
      </Card>
    </main>
  )
}
