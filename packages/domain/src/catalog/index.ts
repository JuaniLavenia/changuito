import type { Unit } from '../types'
import data from './base-catalog.json'

export interface CatalogProduct {
  name: string
  unit: Unit
  /** Default expected monthly consumption, editable once copied into a household. */
  expected: number
}

export interface CatalogSection {
  name: string
  products: CatalogProduct[]
}

export const BASE_CATALOG = data as CatalogSection[]

/** Keeps only the chosen products (by section + name) and drops sections left empty. */
export function pickCatalog(catalog: CatalogSection[], chosen: Set<string>): CatalogSection[] {
  return catalog
    .map((section) => ({
      ...section,
      products: section.products.filter((product) => chosen.has(catalogKey(section.name, product.name))),
    }))
    .filter((section) => section.products.length > 0)
}

export function catalogKey(sectionName: string, productName: string): string {
  return `${sectionName}/${productName}`
}
