import { sortBySection, type Section } from '@changuito/domain'

interface Groupable {
  name: string
  sectionId: string | null
}

export interface SectionGroup<T> {
  id: string
  name: string
  items: T[]
}

/** Groups items by section in store order; items without a known section go last. */
export function groupBySection<T extends Groupable>(items: T[], sections: Section[]): SectionGroup<T>[] {
  const groups = new Map<string | null, T[]>()
  for (const item of sortBySection(items, sections)) {
    const key = item.sectionId && sections.some((s) => s.id === item.sectionId) ? item.sectionId : null
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()].map(([sectionId, grouped]) => ({
    id: sectionId ?? 'none',
    name: sections.find((s) => s.id === sectionId)?.name ?? 'Sin sección',
    items: grouped,
  }))
}
