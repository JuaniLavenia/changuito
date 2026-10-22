import { describe, expect, it } from 'vitest'
import { sortBySection } from './sections'

describe('sortBySection', () => {
  it('orders items by section sort order, then by name', () => {
    const sections = [
      { id: 'dairy', name: 'Dairy', sortOrder: 2 },
      { id: 'produce', name: 'Produce', sortOrder: 1 },
    ]
    const items = [
      { name: 'Yogurt', sectionId: 'dairy' },
      { name: 'Tomato', sectionId: 'produce' },
      { name: 'Butter', sectionId: 'dairy' },
      { name: 'Apple', sectionId: 'produce' },
    ]

    expect(sortBySection(items, sections).map((i) => i.name)).toEqual([
      'Apple',
      'Tomato',
      'Butter',
      'Yogurt',
    ])
  })

  it('puts items with an unknown section last', () => {
    const sections = [{ id: 'dairy', name: 'Dairy', sortOrder: 1 }]
    const items = [
      { name: 'Mystery', sectionId: null },
      { name: 'Milk', sectionId: 'dairy' },
    ]

    expect(sortBySection(items, sections).map((i) => i.name)).toEqual(['Milk', 'Mystery'])
  })
})
