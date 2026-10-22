import type { CarryOverItem, Product, StockSnapshot, SuggestedItem } from './types'

function assertQuantity(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative number, got ${value}`)
  }
}

/** toBuy = max(0, expectedMonthlyConsumption - currentStock) */
export function suggestQuantity(expectedMonthlyConsumption: number, currentStock: number): number {
  assertQuantity('expectedMonthlyConsumption', expectedMonthlyConsumption)
  assertQuantity('currentStock', currentStock)
  return Math.max(0, expectedMonthlyConsumption - currentStock)
}

interface BuildSuggestedListInput {
  products: Product[]
  stock: StockSnapshot
  /** Items skipped on the previous trip, offered again this month. */
  carryOver?: CarryOverItem[]
}

/**
 * Builds the month's suggested list from the stock review.
 * A product missing from the review counts as out of stock.
 */
export function buildSuggestedList({
  products,
  stock,
  carryOver = [],
}: BuildSuggestedListInput): SuggestedItem[] {
  const carried = new Map(carryOver.map((item) => [item.productId, item.quantity]))

  return products.flatMap((product) => {
    const suggested = suggestQuantity(product.expectedMonthlyConsumption, stock[product.id] ?? 0)
    const carriedQuantity = carried.get(product.id)

    if (suggested > 0) {
      return [{ productId: product.id, quantity: suggested, carriedOver: carriedQuantity !== undefined }]
    }
    if (carriedQuantity !== undefined) {
      return [{ productId: product.id, quantity: carriedQuantity, carriedOver: true }]
    }
    return []
  })
}
