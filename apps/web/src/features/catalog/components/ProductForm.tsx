import { useState } from 'react'
import { UNITS, type Product, type Section, type Unit } from '@changuito/domain'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { UNIT_LABELS } from '@/lib/format'
import type { ProductInput } from '../catalog-repository'

const NEW_SECTION = '__new__'

export interface ProductFormValues {
  input: ProductInput
  newSectionName?: string
}

interface ProductFormProps {
  sections: Section[]
  initial?: Product
  pending: boolean
  onSubmit: (values: ProductFormValues) => void
  onArchive?: () => void
}

export const ProductForm = ({ sections, initial, pending, onSubmit, onArchive }: ProductFormProps) => {
  const [name, setName] = useState(initial?.name ?? '')
  const [sectionId, setSectionId] = useState(initial?.sectionId ?? sections[0]?.id ?? '')
  const [newSectionName, setNewSectionName] = useState('')
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? 'unit')
  const [expected, setExpected] = useState(String(initial?.expectedMonthlyConsumption ?? 1))
  const [brand, setBrand] = useState(initial?.preferredBrand ?? '')

  const creatingSection = sectionId === NEW_SECTION
  const expectedValue = Number(expected.replace(',', '.'))
  const valid =
    name.trim().length > 0 &&
    expected.trim() !== '' &&
    Number.isFinite(expectedValue) &&
    expectedValue >= 0 &&
    (!creatingSection || newSectionName.trim().length > 0)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    onSubmit({
      input: {
        name: name.trim(),
        sectionId: creatingSection || sectionId === '' ? null : sectionId,
        unit,
        preferredBrand: brand.trim() || null,
        expectedMonthlyConsumption: expectedValue,
      },
      newSectionName: creatingSection ? newSectionName.trim() : undefined,
    })
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field id="product-name" label="Nombre">
        <Input id="product-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field id="product-section" label="Sección">
        <Select id="product-section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
          <option value="">Sin sección</option>
          <option value={NEW_SECTION}>Nueva sección…</option>
        </Select>
      </Field>

      {creatingSection && (
        <Field id="new-section-name" label="Nombre de la sección">
          <Input
            id="new-section-name"
            value={newSectionName}
            maxLength={60}
            onChange={(e) => setNewSectionName(e.target.value)}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field id="product-expected" label="Consumo por mes">
          <Input
            id="product-expected"
            inputMode="decimal"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
          />
        </Field>
        <Field id="product-unit" label="Unidad">
          <Select id="product-unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {UNITS.map((value) => (
              <option key={value} value={value}>
                {UNIT_LABELS[value].plural}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field id="product-brand" label="Marca preferida (opcional)">
        <Input
          id="product-brand"
          value={brand}
          maxLength={60}
          placeholder="Solo si siempre compran la misma"
          onChange={(e) => setBrand(e.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!valid || pending}>
          Guardar
        </Button>
        {onArchive && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={onArchive} disabled={pending}>
            Quitar del catálogo
          </Button>
        )}
      </div>
    </form>
  )
}
