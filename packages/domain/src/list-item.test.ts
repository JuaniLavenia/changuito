import { describe, expect, it } from 'vitest'
import { checkItem, skipItem, uncheckItem } from './list-item'
import type { ListItem } from './types'

const pending = (): ListItem => ({
  id: 'item-1',
  productId: 'milk',
  quantity: 2,
  status: 'pending',
  skipReason: null,
  price: null,
  brand: null,
  checkedBy: null,
})

describe('checkItem', () => {
  it('moves the item into the cart and records who checked it, price and brand', () => {
    const item = checkItem(pending(), { userId: 'dad', price: 1500, brand: 'La Serenisima' })

    expect(item).toMatchObject({
      status: 'in_cart',
      checkedBy: 'dad',
      price: 1500,
      brand: 'La Serenisima',
      skipReason: null,
    })
  })

  it('allows checking without price or brand', () => {
    const item = checkItem(pending(), { userId: 'me' })

    expect(item).toMatchObject({ status: 'in_cart', price: null, brand: null })
  })

  it('normalizes a blank brand to null', () => {
    expect(checkItem(pending(), { userId: 'me', brand: '   ' }).brand).toBeNull()
  })

  it('rejects a negative price', () => {
    expect(() => checkItem(pending(), { userId: 'me', price: -1 })).toThrow(RangeError)
  })
})

describe('uncheckItem', () => {
  it('returns a checked item to pending and clears purchase data', () => {
    const item = uncheckItem(checkItem(pending(), { userId: 'dad', price: 10, brand: 'X' }))

    expect(item).toMatchObject({ status: 'pending', checkedBy: null, price: null, brand: null })
  })

  it('returns a skipped item to pending and clears the reason', () => {
    const item = uncheckItem(skipItem(pending(), 'unavailable'))

    expect(item).toMatchObject({ status: 'pending', skipReason: null })
  })
})

describe('skipItem', () => {
  it.each(['unavailable', 'too_expensive'] as const)('records the %s reason', (reason) => {
    const item = skipItem(pending(), reason)

    expect(item).toMatchObject({ status: 'skipped', skipReason: reason, checkedBy: null, price: null })
  })
})
