import type { CarryOverItem, ListItem } from './types'

export interface TripSummary {
  bought: ListItem[]
  skipped: ListItem[]
  carryOver: CarryOverItem[]
}

export class PendingItemsError extends Error {
  readonly productIds: string[]

  constructor(productIds: string[]) {
    super(`Cannot close the trip with pending items: ${productIds.join(', ')}`)
    this.name = 'PendingItemsError'
    this.productIds = productIds
  }
}

/** Every item must be in the cart or skipped with a reason before the trip closes. */
export function closeTrip(items: ListItem[]): TripSummary {
  const pending = items.filter((item) => item.status === 'pending')
  if (pending.length > 0) {
    throw new PendingItemsError(pending.map((item) => item.productId))
  }

  const bought = items.filter((item) => item.status === 'in_cart')
  const skipped = items.filter((item) => item.status === 'skipped')

  return {
    bought,
    skipped,
    carryOver: skipped.map(({ productId, quantity }) => ({ productId, quantity })),
  }
}

/** What the items in the cart cost: unit price times quantity. Items without a recorded price count as zero. */
export function tripSpend(items: Pick<ListItem, 'status' | 'price' | 'quantity'>[]): number {
  return items
    .filter((item) => item.status === 'in_cart')
    .reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0)
}

/** Relative change against the previous total (0.1 = 10% more), or null when there is nothing to compare with. */
export function spendingChange(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null
}
