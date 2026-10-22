import { describe, expect, it } from 'vitest'
import { UNITS } from '../types'
import { BASE_CATALOG, catalogKey, pickCatalog } from './index'

describe('BASE_CATALOG', () => {
  const products = BASE_CATALOG.flatMap((section) => section.products)

  it('ships between 80 and 100 products', () => {
    expect(products.length).toBeGreaterThanOrEqual(80)
    expect(products.length).toBeLessThanOrEqual(100)
  })

  it('uses only supported units and non-negative defaults', () => {
    for (const product of products) {
      expect(UNITS).toContain(product.unit)
      expect(product.expected).toBeGreaterThanOrEqual(0)
    }
  })

  it('has no duplicate product names', () => {
    const names = products.map((product) => product.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('pickCatalog', () => {
  const catalog = [
    { name: 'Lácteos', products: [{ name: 'Leche', unit: 'l' as const, expected: 8 }] },
    {
      name: 'Limpieza',
      products: [
        { name: 'Detergente', unit: 'unit' as const, expected: 2 },
        { name: 'Lavandina', unit: 'l' as const, expected: 2 },
      ],
    },
  ]

  it('keeps only the chosen products and drops empty sections', () => {
    const picked = pickCatalog(catalog, new Set([catalogKey('Limpieza', 'Lavandina')]))

    expect(picked).toEqual([{ name: 'Limpieza', products: [{ name: 'Lavandina', unit: 'l', expected: 2 }] }])
  })
})
