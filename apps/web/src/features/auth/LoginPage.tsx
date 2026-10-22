import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useRepositories } from '@/app/repositories'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

export const LoginPage = () => {
  const { auth } = useRepositories()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const signIn = async () => {
    setError(null)
    setPending(true)
    try {
      await auth.signInWithGoogle()
    } catch {
      setError('No pudimos iniciar sesión con Google. Inténtalo de nuevo.')
      setPending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4 text-center">
      <ShoppingCart aria-hidden className="h-14 w-14 text-primary" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-primary">Changuito</h1>
        <p className="text-muted-foreground">Organiza la compra del mes con toda tu casa.</p>
      </div>
      <Button size="lg" className="w-full" onClick={signIn} disabled={pending}>
        Continuar con Google
      </Button>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </main>
  )
}
