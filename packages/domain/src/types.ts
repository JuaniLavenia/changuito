export const UNITS = ['unit', 'kg', 'g', 'l', 'ml', 'pack'] as const
export type Unit = (typeof UNITS)[number]

export const SKIP_REASONS = ['unavailable', 'too_expensive'] as const
export type SkipReason = (typeof SKIP_REASONS)[number]

export type ListItemStatus = 'pending' | 'in_cart' | 'skipped'

export interface Section {
  id: string
  name: string
  sortOrder: number
}

export interface Product {
  id: string
  name: string
  sectionId: string | null
  unit: Unit
  preferredBrand: string | null
  expectedMonthlyConsumption: number
}

/** Current quantity per product id, as entered during the stock review. */
export type StockSnapshot = Record<string, number>

export interface CarryOverItem {
  productId: string
  quantity: number
}

export interface SuggestedItem {
  productId: string
  quantity: number
  carriedOver: boolean
}

export interface ListItem {
  id: string
  productId: string
  quantity: number
  status: ListItemStatus
  skipReason: SkipReason | null
  /** Unit price paid, recorded when the item goes into the cart. */
  price: number | null
  brand: string | null
  checkedBy: string | null
}
