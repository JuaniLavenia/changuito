import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ClipboardList, Undo2 } from 'lucide-react'
import { checkItem, uncheckItem, type Section } from '@changuito/domain'
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
import { useListItems, useListItemsRealtime, useOpenList, useSaveItem } from './queries'

export const ShoppingPage = ({ household }: { household: Household }) => {
  const openList = useOpenList(household.id)
  const sections = useSections(household.id)

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

  return <ShoppingTrip list={openList.data} sections={sections.data} />
}

const checkedSummary = (item: ShoppingItem) =>
  [
    `Lo tachó ${item.checkedByName ?? 'alguien'}`,
    item.brand,
    item.price === null ? null : formatPrice(item.price),
  ]
    .filter(Boolean)
    .join(' · ')

const ShoppingTrip = ({ list, sections }: { list: ShoppingList; sections: Section[] }) => {
  const items = useListItems(list.id)
  const saveItem = useSaveItem(list.id)
  const session = useSession()
  const [checking, setChecking] = useState<ShoppingItem | null>(null)
  useListItemsRealtime(list.id)

  if (items.isPending) return <Spinner />
  if (items.isError) return <ErrorMessage>No pudimos cargar la lista. Revisa tu conexión.</ErrorMessage>

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
                    <p className="text-sm text-muted-foreground">
                      {checked ? checkedSummary(item) : formatQuantity(item.quantity, item.unit)}
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
                      disabled={item.status !== 'pending'}
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
