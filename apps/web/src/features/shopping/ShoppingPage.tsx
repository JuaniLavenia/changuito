import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, ClipboardList, Home, Undo2 } from 'lucide-react'
import {
  checkItem,
  closeTrip,
  SKIP_REASONS,
  skipItem,
  uncheckItem,
  type Section,
  type SkipReason,
} from '@changuito/domain'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { formatPrice, formatQuantity } from '@/lib/format'
import { parseQuantity } from '@/lib/parse'
import { cn } from '@/lib/utils'
import { useSession } from '@/features/auth/useSession'
import { groupBySection } from '@/features/catalog/group-by-section'
import { useSections } from '@/features/catalog/queries'
import type { Household } from '@/features/households/household-repository'
import type { ShoppingItem, ShoppingList } from './shopping-repository'
import { useCloseTrip, useListItems, useListItemsRealtime, useOpenList, useSaveItem } from './queries'

const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  unavailable: 'No había',
  too_expensive: 'Estaba caro',
}

const productLabel = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`

interface ClosedTrip {
  boughtCount: number
  total: number
  carriedOverCount: number
}

export const ShoppingPage = ({ household }: { household: Household }) => {
  const openList = useOpenList(household.id)
  const sections = useSections(household.id)
  const [closed, setClosed] = useState<ClosedTrip | null>(null)

  if (closed) return <ClosedTripCard trip={closed} />
  if (openList.isPending || sections.isPending) return <Spinner />
  if (openList.isError || sections.isError) {
    return <ErrorMessage>No pudimos cargar la lista. Revisa tu conexión.</ErrorMessage>
  }

  if (!openList.data) {
    return (
      <Card className="space-y-3">
        <h1 className="text-xl font-semibold text-primary">En el súper</h1>
        <p>Todavía no tienen la lista de este mes.</p>
        <Link
          to="/stock"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          <ClipboardList aria-hidden className="h-4 w-4" />
          Revisar stock
        </Link>
      </Card>
    )
  }

  return (
    <ShoppingTrip householdId={household.id} list={openList.data} sections={sections.data} onClosed={setClosed} />
  )
}

const ClosedTripCard = ({ trip }: { trip: ClosedTrip }) => (
  <Card className="space-y-3">
    <h1 className="text-xl font-semibold text-primary">Compra cerrada</h1>
    <p>
      {trip.boughtCount > 0
        ? `Compraste ${productLabel(trip.boughtCount)} por ${formatPrice(trip.total)}.`
        : 'Esta vez no compraron nada de la lista.'}
    </p>
    {trip.carriedOverCount > 0 && (
      <p>
        {productLabel(trip.carriedOverCount)} {trip.carriedOverCount === 1 ? 'queda' : 'quedan'} para la lista del mes
        que viene.
      </p>
    )}
    <Link
      to="/"
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
    >
      <Home aria-hidden className="h-4 w-4" />
      Volver al inicio
    </Link>
  </Card>
)

const itemSummary = (item: ShoppingItem) => {
  if (item.status === 'skipped' && item.skipReason) return SKIP_REASON_LABELS[item.skipReason]
  if (item.status !== 'in_cart') return formatQuantity(item.quantity, item.unit)
  return [
    `Lo tachó ${item.checkedByName ?? 'alguien'}`,
    item.brand,
    item.price === null ? null : formatPrice(item.price),
  ]
    .filter(Boolean)
    .join(' · ')
}

interface ShoppingTripProps {
  householdId: string
  list: ShoppingList
  sections: Section[]
  onClosed: (trip: ClosedTrip) => void
}

const ShoppingTrip = ({ householdId, list, sections, onClosed }: ShoppingTripProps) => {
  const items = useListItems(list.id)
  const saveItem = useSaveItem(list.id)
  const session = useSession()
  const [checking, setChecking] = useState<ShoppingItem | null>(null)
  const [closing, setClosing] = useState(false)
  useListItemsRealtime(list.id)

  if (items.isPending) return <Spinner />
  if (items.isError) return <ErrorMessage>No pudimos cargar la lista. Revisa tu conexión.</ErrorMessage>

  if (closing) {
    return (
      <CloseTrip
        householdId={householdId}
        listId={list.id}
        items={items.data}
        onBack={() => setClosing(false)}
        onClosed={onClosed}
      />
    )
  }

  const inCart = items.data.filter((item) => item.status === 'in_cart').length

  const putInCart = ({ price, brand }: { price: number | null; brand: string }) => {
    if (!checking || session.status !== 'signed-in') return
    saveItem.mutate(checkItem(checking, { userId: session.user.id, price, brand }), {
      onSuccess: () => setChecking(null),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">En el súper</h1>
        <p className="text-muted-foreground">
          {inCart} de {items.data.length} en el carrito
        </p>
      </div>

      {saveItem.isError && !checking && <ErrorMessage>No pudimos guardar el cambio. Inténtalo de nuevo.</ErrorMessage>}

      {groupBySection(items.data, sections).map((group) => (
        <section key={group.id} aria-labelledby={`super-section-${group.id}`} className="space-y-2">
          <h2
            id={`super-section-${group.id}`}
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {group.name}
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {group.items.map((item) => {
              const checked = item.status === 'in_cart'
              return (
                <li key={item.id} aria-label={item.name} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate font-medium', checked && 'text-muted-foreground line-through')}>
                      {item.name}
                    </p>
                    <p className={cn('text-sm text-muted-foreground', item.status === 'skipped' && 'text-warning')}>
                      {itemSummary(item)}
                    </p>
                  </div>
                  {checked ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Destachar ${item.name}`}
                      disabled={saveItem.isPending}
                      onClick={() => saveItem.mutate(uncheckItem(item))}
                    >
                      <Undo2 aria-hidden className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Tachar ${item.name}`}
                      onClick={() => {
                        saveItem.reset()
                        setChecking(item)
                      }}
                    >
                      <Check aria-hidden className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-16 bg-background py-3">
        <Button size="lg" variant="outline" className="w-full" onClick={() => setClosing(true)}>
          Terminar compra
        </Button>
      </div>

      <Dialog
        open={checking !== null}
        onOpenChange={(open) => !open && setChecking(null)}
        title={checking ? `Tachar ${checking.name}` : ''}
      >
        {checking && (
          <CheckForm
            key={checking.id}
            item={checking}
            pending={saveItem.isPending}
            failed={saveItem.isError}
            onSubmit={putInCart}
          />
        )}
      </Dialog>
    </div>
  )
}

interface CloseTripProps {
  householdId: string
  listId: string
  items: ShoppingItem[]
  onBack: () => void
  onClosed: (trip: ClosedTrip) => void
}

const CloseTrip = ({ householdId, listId, items, onBack, onClosed }: CloseTripProps) => {
  const closeTripMutation = useCloseTrip(householdId, listId)
  const notBought = items.filter((item) => item.status !== 'in_cart')
  const [reasons, setReasons] = useState<Record<string, SkipReason>>(() =>
    Object.fromEntries(notBought.flatMap((item) => (item.skipReason ? [[item.id, item.skipReason]] : []))),
  )
  const ready = notBought.every((item) => reasons[item.id])

  const close = async () => {
    const skipped = notBought
      .filter((item) => item.status !== 'skipped' || item.skipReason !== reasons[item.id])
      .map((item) => skipItem(item, reasons[item.id]))
    const finalItems = items.map((item) => (reasons[item.id] ? skipItem(item, reasons[item.id]) : item))
    const summary = closeTrip(finalItems)
    try {
      await closeTripMutation.mutateAsync(skipped)
    } catch {
      return
    }
    onClosed({
      boughtCount: summary.bought.length,
      total: summary.bought.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0),
      carriedOverCount: summary.carryOver.length,
    })
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Volver a la lista
      </Button>
      <div>
        <h1 className="text-2xl font-semibold text-primary">Cerrar la compra</h1>
        {notBought.length > 0 ? (
          <p className="text-muted-foreground">
            Cuéntanos por qué no compraron estas cosas. Te las vamos a ofrecer en la lista del mes que viene.
          </p>
        ) : (
          <p className="text-muted-foreground">Todo está en el carrito.</p>
        )}
      </div>

      {notBought.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {notBought.map((item) => (
            <li key={item.id} className="space-y-2 px-3 py-3">
              <p className="font-medium">
                {item.name}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {formatQuantity(item.quantity, item.unit)}
                </span>
              </p>
              <div role="radiogroup" aria-label={item.name} className="flex gap-2">
                {SKIP_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={cn(
                      'flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border text-sm',
                      reasons[item.id] === reason && 'border-primary bg-accent text-primary',
                    )}
                  >
                    <input
                      type="radio"
                      name={`reason-${item.id}`}
                      value={reason}
                      className="sr-only"
                      checked={reasons[item.id] === reason}
                      onChange={() => setReasons({ ...reasons, [item.id]: reason })}
                    />
                    {SKIP_REASON_LABELS[reason]}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {closeTripMutation.isError && <ErrorMessage>No pudimos cerrar la compra. Inténtalo de nuevo.</ErrorMessage>}
      <Button size="lg" className="w-full" onClick={close} disabled={!ready || closeTripMutation.isPending}>
        Cerrar compra
      </Button>
    </div>
  )
}

interface CheckFormProps {
  item: ShoppingItem
  pending: boolean
  failed: boolean
  onSubmit: (values: { price: number | null; brand: string }) => void
}

const CheckForm = ({ item, pending, failed, onSubmit }: CheckFormProps) => {
  const [price, setPrice] = useState('')
  const [brand, setBrand] = useState(item.preferredBrand ?? '')
  const parsedPrice = parseQuantity(price)
  const priceInvalid = price.trim() !== '' && parsedPrice === null

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (priceInvalid) return
    onSubmit({ price: parsedPrice, brand })
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-muted-foreground">{formatQuantity(item.quantity, item.unit)}</p>
      <Field id="check-price" label="Precio por unidad">
        <Input
          id="check-price"
          inputMode="decimal"
          placeholder="0"
          autoFocus
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </Field>
      <Field id="check-brand" label="Marca (opcional)">
        <Input id="check-brand" maxLength={60} value={brand} onChange={(event) => setBrand(event.target.value)} />
      </Field>
      {priceInvalid && <ErrorMessage>Escribe un precio válido, por ejemplo 1250,50.</ErrorMessage>}
      {failed && <ErrorMessage>No pudimos guardar el cambio. Inténtalo de nuevo.</ErrorMessage>}
      <Button type="submit" size="lg" className="w-full" disabled={pending || priceInvalid}>
        Al carrito
      </Button>
    </form>
  )
}
