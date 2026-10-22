import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, Section, Unit } from '@changuito/domain'

export type ProductInput = Omit<Product, 'id'>

export interface CatalogRepository {
  listSections(householdId: string): Promise<Section[]>
  /** Active (not archived) products of the household. */
  listProducts(householdId: string): Promise<Product[]>
  createProduct(householdId: string, input: ProductInput): Promise<Product>
  updateProduct(productId: string, input: ProductInput): Promise<Product>
  /** Hides the product from the catalog while keeping it in past lists. */
  archiveProduct(productId: string): Promise<void>
  createSection(householdId: string, name: string): Promise<Section>
}

interface ProductRow {
  id: string
  name: string
  section_id: string | null
  unit: Unit
  preferred_brand: string | null
  expected_monthly_consumption: number | string
}

interface SectionRow {
  id: string
  name: string
  sort_order: number
}

const PRODUCT_COLUMNS = 'id, name, section_id, unit, preferred_brand, expected_monthly_consumption'

export const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  sectionId: row.section_id,
  unit: row.unit,
  preferredBrand: row.preferred_brand,
  // numeric columns arrive as strings from PostgREST.
  expectedMonthlyConsumption: Number(row.expected_monthly_consumption),
})

const toSection = (row: SectionRow): Section => ({ id: row.id, name: row.name, sortOrder: row.sort_order })

const toRow = (input: ProductInput) => ({
  name: input.name.trim(),
  section_id: input.sectionId,
  unit: input.unit,
  preferred_brand: input.preferredBrand?.trim() || null,
  expected_monthly_consumption: input.expectedMonthlyConsumption,
})

export function createSupabaseCatalogRepository(supabase: SupabaseClient): CatalogRepository {
  return {
    async listSections(householdId) {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name, sort_order')
        .eq('household_id', householdId)
        .order('sort_order')
        .returns<SectionRow[]>()
      if (error) throw error
      return data.map(toSection)
    },

    async listProducts(householdId) {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('household_id', householdId)
        .is('archived_at', null)
        .returns<ProductRow[]>()
      if (error) throw error
      return data.map(toProduct)
    },

    async createProduct(householdId, input) {
      const { data, error } = await supabase
        .from('products')
        .insert({ household_id: householdId, ...toRow(input) })
        .select(PRODUCT_COLUMNS)
        .single<ProductRow>()
      if (error) throw error
      return toProduct(data)
    },

    async updateProduct(productId, input) {
      const { data, error } = await supabase
        .from('products')
        .update(toRow(input))
        .eq('id', productId)
        .select(PRODUCT_COLUMNS)
        .single<ProductRow>()
      if (error) throw error
      return toProduct(data)
    },

    async archiveProduct(productId) {
      const { error } = await supabase
        .from('products')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', productId)
      if (error) throw error
    },

    async createSection(householdId, name) {
      const { data: last } = await supabase
        .from('sections')
        .select('sort_order')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle<{ sort_order: number }>()
      const { data, error } = await supabase
        .from('sections')
        .insert({ household_id: householdId, name: name.trim(), sort_order: (last?.sort_order ?? 0) + 1 })
        .select('id, name, sort_order')
        .single<SectionRow>()
      if (error) throw error
      return toSection(data)
    },
  }
}
