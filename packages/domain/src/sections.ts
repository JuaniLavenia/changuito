import type { Section } from './types'

interface Sortable {
  name: string
  sectionId: string | null
}

/** Orders items the way the store is walked: by section order, then by name. */
export function sortBySection<T extends Sortable>(items: T[], sections: Section[]): T[] {
  const order = new Map(sections.map((section) => [section.id, section.sortOrder]))
  const rank = (item: T) => (item.sectionId ? order.get(item.sectionId) : undefined) ?? Infinity

  return [...items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'))
}
