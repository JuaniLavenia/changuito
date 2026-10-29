import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, X } from 'lucide-react'
import {
  buildSuggestedList,
  suggestQuantity,
  type CarryOverItem,
  type Product,
  type Section,
  type StockSnapshot,
  type SuggestedItem,
} from '@changuito/domain'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { formatQuantity, UNIT_LABELS } from '@/lib/format'
import { parseQuantity } from '@/lib/parse'
import { cn } from '@/lib/utils'
import { groupBySection } from '@/features/catalog/group-by-section'
import { useProducts, useSections } from '@/features/catalog/queries'
import type { Household } from '@/features/households/household-repository'
import { useCarryOver, useCreateList, useOpenList } from '@/features/shopping/queries'

interface DraftItem {
  productId: string
  quantity: string
  carriedOver: boolean
}

const productLabel = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`

export const StockReviewPage = ({ household }: { household: Household }) => {
  const openList = useOpenList(household.id)
  const sections = useSections(household.id)
  const products = useProducts(household.id)
  const carryOver = useCarryOver(household.id)

  const queries = [openList, sections, products, carryOver]
  if (queries.some((query) => query.isPending)) return <Spinner />
  if (queries.some((query) => query.isError)) {
    return <ErrorMessage>No pudimos cargar el stock. Revisa tu conexión.</ErrorMessage>
  }

  if (openList.data) {
    return (
      <Card className="space-y-3">
        <h1 className="text-xl font-semibold text-primary">Revisar stock</h1>
        <p>Ya tienen la lista de este mes.</p>
        <Link
          to="/super"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          <ShoppingCart aria-hidden className="h-4 w-4" />
          Ir al súper
        </Link>
      </Card>
    )
  }

  return (
    <StockReview
      householdId={household.id}
      products={products.data!}
      sections={sections.data!}
      carryOver={carryOver.data!}
    />
  )
}

interface StockReviewProps {
  householdId: string
  products: Product[]
  sections: Section[]
  carryOver: CarryOverItem[]
}

const StockReview = ({ householdId, products, sections, carryOver }: StockReviewProps) => {
  const createList = useCreateList(householdId)
  const [stockInput, setStockInput] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState<DraftItem[] | null>(null)

  const stock: StockSnapshot = Object.fromEntries(
    products.map((product) => [product.id, parseQuantity(stockInput[product.id] ?? '') ?? 0]),
  )
  const suggested = buildSuggestedList({ products, stock, carryOver })
  const byId = new Map(products.map((product) => [product.id, product]))

  const openPreview = () =>
    setDraft(suggested.map((item) => ({ ...item, quantity: String(item.quantity) })))

  const draftItems: SuggestedItem[] = (draft ?? []).flatMap((item) => {
    const quantity = parseQuantity(item.quantity)
    return quantity ? [{ productId: item.productId, quantity, carriedOver: item.carriedOver }] : []
  })

  const save = () => createList.mutate({ stock, items: draftItems })

  if (draft) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Volver al stock
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-primary">Lista sugerida</h1>
          <p className="text-muted-foreground">Ajusta las cantidades si este mes necesitan otra cosa.</p>
        </div>
        <ul aria-label="Lista sugerida" className="divide-y divide-border rounded-lg border border-border bg-card">
          {draft.map((item) => {
            const product = byId.get(item.productId)!
            return (
              <li key={item.productId} aria-label={product.name} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{product.name}</p>
                  {item.carriedOver && <p className="text-xs text-warning">Quedó del mes pasado</p>}
                </div>
                <Input
                  aria-label={`Cantidad de ${product.name}`}
                  inputMode="decimal"
                  className="w-20 text-right"
                  value={item.quantity}
                  onChange={(event) =>
                    setDraft(draft.map((d) => (d.productId === item.productId ? { ...d, quantity: event.target.value } : d)))
                  }
                />
                <span className="w-16 text-sm text-muted-foreground">{UNIT_LABELS[product.unit].plural}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar ${product.name}`}
                  onClick={() => setDraft(draft.filter((d) => d.productId !== item.productId))}
                >
                  <X aria-hidden className="h-4 w-4" />
                </Button>
              </li>
            )
          })}
        </ul>
        {createList.isError && <ErrorMessage>No pudimos guardar la lista. Inténtalo de nuevo.</ErrorMessage>}
        <Button size="lg" className="w-full" onClick={save} disabled={draftItems.length === 0 || createList.isPending}>
          Guardar lista
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Revisar stock</h1>
        <p className="text-muted-foreground">Anota cuánto queda de cada cosa. Si no queda nada, déjalo vacío.</p>
      </div>

      {products.length === 0 && <p className="text-muted-foreground">Primero agrega productos al catálogo.</p>}

      {groupBySection(products, sections).map((group) => (
        <section key={group.id} aria-labelledby={`stock-section-${group.id}`} className="space-y-2">
          <h2
            id={`stock-section-${group.id}`}
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {group.name}
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {group.items.map((product) => {
              const toBuy = suggestQuantity(product.expectedMonthlyConsumption, stock[product.id])
              const inputId = `stock-${product.id}`
              return (
                <div
                  key={product.id}
                  role="group"
                  aria-labelledby={`${inputId}-name`}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p id={`${inputId}-name`} className="truncate font-medium">
                      {product.name}
                    </p>
                    <p className={cn('text-sm', toBuy > 0 ? 'text-primary' : 'text-muted-foreground')}>
                      {toBuy > 0 ? `Comprar ${formatQuantity(toBuy, product.unit)}` : 'No hace falta'}
                    </p>
                  </div>
                  <Input
                    id={inputId}
                    aria-label={`¿Cuánto queda de ${product.name}?`}
                    inputMode="decimal"
                    placeholder="0"
                    className="w-20 text-right"
                    value={stockInput[product.id] ?? ''}
                    onChange={(event) => setStockInput({ ...stockInput, [product.id]: event.target.value })}
                  />
                  <span className="w-16 text-sm text-muted-foreground">{UNIT_LABELS[product.unit].plural}</span>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-(--bottom-nav-height) bg-background py-3">
        <Button size="lg" className="w-full" onClick={openPreview} disabled={suggested.length === 0}>
          Ver la lista ({productLabel(suggested.length)})
        </Button>
      </div>
    </div>
  )
}
