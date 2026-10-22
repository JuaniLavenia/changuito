import { catalogKey, type CatalogSection } from '@changuito/domain'
import { formatQuantity } from '@/lib/format'

interface CatalogPickerProps {
  catalog: CatalogSection[]
  chosen: Set<string>
  onToggleProduct: (key: string) => void
  onToggleSection: (section: CatalogSection, checked: boolean) => void
}

export const CatalogPicker = ({ catalog, chosen, onToggleProduct, onToggleSection }: CatalogPickerProps) => {
  return (
    <div className="space-y-4">
      {catalog.map((section) => {
        const keys = section.products.map((product) => catalogKey(section.name, product.name))
        const allChosen = keys.every((key) => chosen.has(key))

        return (
          <fieldset key={section.name} className="rounded-lg border border-border bg-card p-3">
            <legend className="px-1 text-sm font-semibold text-primary">{section.name}</legend>
            <label className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={allChosen}
                onChange={(event) => onToggleSection(section, event.target.checked)}
              />
              <span>
                Toda la sección <span className="sr-only">{section.name}</span>
              </span>
            </label>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {section.products.map((product) => {
                const key = catalogKey(section.name, product.name)
                return (
                  <li key={key} className="flex items-center justify-between gap-2 rounded-md px-1 py-1">
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-primary"
                        checked={chosen.has(key)}
                        onChange={() => onToggleProduct(key)}
                      />
                      <span>{product.name}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {formatQuantity(product.expected, product.unit)}/mes
                    </span>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )
      })}
    </div>
  )
}
