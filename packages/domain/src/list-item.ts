import type { ListItem, SkipReason } from './types'

interface CheckInput {
  userId: string
  price?: number | null
  brand?: string | null
}

export function checkItem(item: ListItem, { userId, price = null, brand = null }: CheckInput): ListItem {
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    throw new RangeError(`price must be a non-negative number, got ${price}`)
  }
  return {
    ...item,
    status: 'in_cart',
    skipReason: null,
    checkedBy: userId,
    price,
    brand: brand?.trim() || null,
  }
}

export function uncheckItem(item: ListItem): ListItem {
  return { ...item, status: 'pending', skipReason: null, checkedBy: null, price: null, brand: null }
}

export function skipItem(item: ListItem, reason: SkipReason): ListItem {
  return { ...uncheckItem(item), status: 'skipped', skipReason: reason }
}
