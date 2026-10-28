import { describe, expect, it } from 'vitest'
import { closeTrip } from './trip'
import type { ListItem } from './types'

const item = (overrides: Partial<ListItem>): ListItem => ({
  id: overrides.productId ?? 'id',
  productId: 'p',
  quantity: 1,
  status: 'pending',
  skipReason: null,
  price: null,
  brand: null,
  checkedBy: null,
  ...overrides,
})

describe('closeTrip', () => {
  it('splits bought and skipped items and carries skipped ones to next month', () => {
    const summary = closeTrip([
      item({ productId: 'milk', status: 'in_cart' }),
      item({ productId: 'oil', quantity: 2, status: 'skipped', skipReason: 'too_expensive' }),
      item({ productId: 'flour', status: 'skipped', skipReason: 'unavailable' }),
    ])

    expect(summary.bought.map((i) => i.productId)).toEqual(['milk'])
    expect(summary.skipped.map((i) => i.productId)).toEqual(['oil', 'flour'])
    expect(summary.carryOver).toEqual([
      { productId: 'oil', quantity: 2 },
      { productId: 'flour', quantity: 1 },
    ])
  })

  it('refuses to close while items are still pending, naming them', () => {
    expect(() =>
      closeTrip([item({ productId: 'milk' }), item({ productId: 'rice', status: 'in_cart' })]),
    ).toThrow(/milk/)
  })
})
