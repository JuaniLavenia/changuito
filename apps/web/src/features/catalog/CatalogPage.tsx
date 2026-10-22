import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { Product } from '@changuito/domain'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Spinner } from '@/components/ui/Spinner'
import { formatQuantity } from '@/lib/format'
import type { Household } from '@/features/households/household-repository'
import { ProductForm, type ProductFormValues } from './components/ProductForm'
import { groupBySection } from './group-by-section'
import { useArchiveProduct, useProducts, useSaveProduct, useSections } from './queries'

type Editing = { mode: 'new' } | { mode: 'edit'; product: Product } | null

export const CatalogPage = ({ household }: { household: Household }) => {
  const sections = useSections(household.id)
  const products = useProducts(household.id)
  const saveProduct = useSaveProduct(household.id)
  const archiveProduct = useArchiveProduct(household.id)
  const [editing, setEditing] = useState<Editing>(null)

  const close = () => {
    setEditing(null)
    saveProduct.reset()
  }

  const save = async (values: ProductFormValues) => {
    await saveProduct.mutateAsync({
      productId: editing?.mode === 'edit' ? editing.product.id : undefined,
      ...values,
    })
    close()
  }

  const archive = async (productId: string) => {
    await archiveProduct.mutateAsync(productId)
    close()
  }

  if (sections.isPending || products.isPending) return <Spinner />
  if (sections.isError || products.isError) {
    return <ErrorMessage>No pudimos cargar el catálogo. Revisa tu conexión.</ErrorMessage>
  }

  const groups = groupBySection(products.data, sections.data)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-primary">Catálogo</h1>
        <Button size="sm" onClick={() => setEditing({ mode: 'new' })}>
          <Plus aria-hidden className="h-4 w-4" />
          Agregar producto
        </Button>
      </div>

      {groups.length === 0 && <p className="text-muted-foreground">Todavía no hay productos en el catálogo.</p>}

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`section-${group.id}`} className="space-y-2">
          <h2 id={`section-${group.id}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.name}
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {group.items.map((product) => (
              <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatQuantity(product.expectedMonthlyConsumption, product.unit)} por mes
                    {product.preferredBrand && ` · ${product.preferredBrand}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${product.name}`}
                  onClick={() => setEditing({ mode: 'edit', product })}
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && close()}
        title={editing?.mode === 'edit' ? 'Editar producto' : 'Nuevo producto'}
      >
        {editing && (
          <div className="space-y-3">
            <ProductForm
              key={editing.mode === 'edit' ? editing.product.id : 'new'}
              sections={sections.data}
              initial={editing.mode === 'edit' ? editing.product : undefined}
              pending={saveProduct.isPending || archiveProduct.isPending}
              onSubmit={save}
              onArchive={editing.mode === 'edit' ? () => archive(editing.product.id) : undefined}
            />
            {(saveProduct.isError || archiveProduct.isError) && (
              <ErrorMessage>No pudimos guardar los cambios. Inténtalo de nuevo.</ErrorMessage>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
