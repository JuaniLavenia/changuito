import { describe, expect, it } from 'vitest'
import { closeTrip, spendingChange, tripSpend } from './trip'
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

describe('tripSpend', () => {
  it('adds unit price times quantity of the items in the cart only', () => {
    const spend = tripSpend([
      item({ productId: 'milk', quantity: 6, status: 'in_cart', price: 1200 }),
      item({ productId: 'rice', quantity: 2, status: 'in_cart', price: 950.5 }),
      item({ productId: 'oil', quantity: 1, status: 'skipped', skipReason: 'too_expensive', price: 5000 }),
      item({ productId: 'flour', quantity: 1, status: 'pending', price: 800 }),
    ])

    expect(spend).toBe(9101)
  })

  it('counts an item in the cart without a recorded price as zero', () => {
    expect(tripSpend([item({ status: 'in_cart', quantity: 3, price: null })])).toBe(0)
  })
})

describe('spendingChange', () => {
  it('returns the change against the previous total as a fraction', () => {
    expect(spendingChange(110_000, 100_000)).toBeCloseTo(0.1)
    expect(spendingChange(75_000, 100_000)).toBeCloseTo(-0.25)
  })

  it('has no change to report without a previous total to compare with', () => {
    expect(spendingChange(50_000, 0)).toBeNull()
  })
})
