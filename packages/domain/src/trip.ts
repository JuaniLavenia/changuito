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
