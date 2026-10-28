import { describe, expect, it } from 'vitest'
import { buildSuggestedList, suggestQuantity } from './shopping-list'
import type { Product } from './types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'tomato',
  name: 'Canned tomato',
  sectionId: 'pantry',
  unit: 'unit',
  preferredBrand: null,
  expectedMonthlyConsumption: 4,
  ...overrides,
})

describe('suggestQuantity', () => {
  it('buys the difference between monthly consumption and current stock', () => {
    expect(suggestQuantity(4, 2)).toBe(2)
  })

  it('buys the whole monthly consumption when nothing is left', () => {
    expect(suggestQuantity(4, 0)).toBe(4)
  })

  it('never suggests a negative quantity when stock exceeds consumption', () => {
    expect(suggestQuantity(4, 5)).toBe(0)
  })

  it('supports fractional units such as kilograms', () => {
    expect(suggestQuantity(1.5, 0.25)).toBe(1.25)
  })

  it('rejects negative or non-finite inputs', () => {
    expect(() => suggestQuantity(-1, 0)).toThrow(RangeError)
    expect(() => suggestQuantity(4, -1)).toThrow(RangeError)
    expect(() => suggestQuantity(Number.NaN, 0)).toThrow(RangeError)
  })
})

describe('buildSuggestedList', () => {
  it('lists only products that need to be bought', () => {
    const products = [
      product({ id: 'tomato', expectedMonthlyConsumption: 4 }),
      product({ id: 'rice', expectedMonthlyConsumption: 2 }),
    ]

    const list = buildSuggestedList({ products, stock: { tomato: 2, rice: 3 } })

    expect(list).toEqual([{ productId: 'tomato', quantity: 2, carriedOver: false }])
  })

  it('treats a product missing from the stock review as out of stock', () => {
    const list = buildSuggestedList({ products: [product()], stock: {} })

    expect(list).toEqual([{ productId: 'tomato', quantity: 4, carriedOver: false }])
  })

  it('flags suggested products that were skipped last month', () => {
    const list = buildSuggestedList({
      products: [product()],
      stock: { tomato: 1 },
      carryOver: [{ productId: 'tomato', quantity: 4 }],
    })

    expect(list).toEqual([{ productId: 'tomato', quantity: 3, carriedOver: true }])
  })

  it('offers skipped products again even when the stock rule suggests nothing', () => {
    const list = buildSuggestedList({
      products: [product({ id: 'oil', expectedMonthlyConsumption: 0 })],
      stock: { oil: 0 },
      carryOver: [{ productId: 'oil', quantity: 2 }],
    })

    expect(list).toEqual([{ productId: 'oil', quantity: 2, carriedOver: true }])
  })

  it('ignores carried-over products that no longer exist in the catalog', () => {
    const list = buildSuggestedList({
      products: [],
      stock: {},
      carryOver: [{ productId: 'deleted', quantity: 1 }],
    })

    expect(list).toEqual([])
  })
})
