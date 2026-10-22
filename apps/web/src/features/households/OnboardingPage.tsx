import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Home, KeyRound } from 'lucide-react'
import { BASE_CATALOG, catalogKey, pickCatalog, type CatalogSection } from '@changuito/domain'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Input } from '@/components/ui/Input'
import { CatalogPicker } from './components/CatalogPicker'
import { InvalidInviteCodeError } from './household-repository'
import { useCreateHousehold, useJoinHousehold } from './queries'

type Step = 'choose' | 'name' | 'catalog' | 'join'

const allCatalogKeys = () =>
  new Set(BASE_CATALOG.flatMap((section) => section.products.map((product) => catalogKey(section.name, product.name))))

export const OnboardingPage = () => {
  const [step, setStep] = useState<Step>('choose')
  const [name, setName] = useState('')

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {step !== 'choose' && (
        <Button variant="ghost" size="sm" onClick={() => setStep(step === 'catalog' ? 'name' : 'choose')}>
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Volver
        </Button>
      )}
      {step === 'choose' && <ChooseStep onCreate={() => setStep('name')} onJoin={() => setStep('join')} />}
      {step === 'name' && <NameStep name={name} onChange={setName} onNext={() => setStep('catalog')} />}
      {step === 'catalog' && <CatalogStep name={name.trim()} />}
      {step === 'join' && <JoinStep />}
    </main>
  )
}

const ChooseStep = ({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) => (
  <div className="space-y-6">
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-primary">¡Bienvenido a Changuito!</h1>
      <p className="text-muted-foreground">Crea el hogar de tu casa o únete al de tu familia con un código.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Button size="lg" onClick={onCreate}>
        <Home aria-hidden className="h-5 w-5" />
        Crear un hogar
      </Button>
      <Button size="lg" variant="secondary" onClick={onJoin}>
        <KeyRound aria-hidden className="h-5 w-5" />
        Unirme con un código
      </Button>
    </div>
  </div>
)

const NameStep = ({ name, onChange, onNext }: { name: string; onChange: (name: string) => void; onNext: () => void }) => (
  <form
    className="space-y-4"
    onSubmit={(event) => {
      event.preventDefault()
      onNext()
    }}
  >
    <h1 className="text-2xl font-semibold text-primary">Crear un hogar</h1>
    <div className="space-y-2">
      <label htmlFor="household-name" className="text-sm font-medium">
        Nombre del hogar
      </label>
      <Input
        id="household-name"
        value={name}
        maxLength={80}
        placeholder="Ej.: Casa de los Pérez"
        onChange={(event) => onChange(event.target.value)}
        autoFocus
      />
    </div>
    <Button type="submit" className="w-full" disabled={!name.trim()}>
      Siguiente
    </Button>
  </form>
)

const CatalogStep = ({ name }: { name: string }) => {
  const navigate = useNavigate()
  const createHousehold = useCreateHousehold()
  const [chosen, setChosen] = useState(allCatalogKeys)

  const toggleProduct = (key: string) =>
    setChosen((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleSection = (section: CatalogSection, checked: boolean) =>
    setChosen((previous) => {
      const next = new Set(previous)
      for (const product of section.products) {
        const key = catalogKey(section.name, product.name)
        if (checked) next.add(key)
        else next.delete(key)
      }
      return next
    })

  const create = async () => {
    await createHousehold.mutateAsync({ name, catalog: pickCatalog(BASE_CATALOG, chosen) })
    navigate('/')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-primary">¿Qué compran en tu casa?</h1>
        <p className="text-muted-foreground">
          Desmarca lo que no usan. Después puedes editar los productos y agregar otros.
        </p>
      </div>
      <CatalogPicker
        catalog={BASE_CATALOG}
        chosen={chosen}
        onToggleProduct={toggleProduct}
        onToggleSection={toggleSection}
      />
      {createHousehold.isError && <ErrorMessage>No pudimos crear el hogar. Inténtalo de nuevo.</ErrorMessage>}
      <div className="sticky bottom-0 bg-background py-3">
        <Button size="lg" className="w-full" onClick={create} disabled={createHousehold.isPending}>
          Crear hogar
        </Button>
        <p className="mt-1 text-center text-xs text-muted-foreground">{chosen.size} productos elegidos</p>
      </div>
    </div>
  )
}

const JoinStep = () => {
  const navigate = useNavigate()
  const joinHousehold = useJoinHousehold()
  const [code, setCode] = useState('')

  const join = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await joinHousehold.mutateAsync(code)
      navigate('/')
    } catch {
      // The error message is rendered from the mutation state.
    }
  }

  const errorMessage =
    joinHousehold.error instanceof InvalidInviteCodeError
      ? 'El código no es válido. Revisa que esté bien escrito.'
      : 'No pudimos unirte al hogar. Inténtalo de nuevo.'

  return (
    <Card>
      <form className="space-y-4" onSubmit={join}>
        <h1 className="text-2xl font-semibold text-primary">Unirme a un hogar</h1>
        <div className="space-y-2">
          <label htmlFor="invite-code" className="text-sm font-medium">
            Código de invitación
          </label>
          <Input
            id="invite-code"
            value={code}
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono uppercase tracking-widest"
            onChange={(event) => setCode(event.target.value)}
            autoFocus
          />
        </div>
        {joinHousehold.isError && <ErrorMessage>{errorMessage}</ErrorMessage>}
        <Button type="submit" className="w-full" disabled={!code.trim() || joinHousehold.isPending}>
          Unirme
        </Button>
      </form>
    </Card>
  )
}
