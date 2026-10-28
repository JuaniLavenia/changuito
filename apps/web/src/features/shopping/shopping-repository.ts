import type { SupabaseClient } from '@supabase/supabase-js'
import type { CarryOverItem, StockSnapshot, SuggestedItem } from '@changuito/domain'

export type ShoppingListStatus = 'draft' | 'shopping' | 'closed'

export interface ShoppingList {
  id: string
  /** First day of the month, ISO date (YYYY-MM-DD). */
  period: string
  status: ShoppingListStatus
}

export interface ShoppingRepository {
  /** The household's list that is not closed yet, if any. */
  getOpenList(householdId: string): Promise<ShoppingList | null>
  /** Items skipped on the most recently closed list, offered again this month. */
  getCarryOver(householdId: string): Promise<CarryOverItem[]>
  /** Saves the stock review and the list built from it, atomically. */
  createList(householdId: string, stock: StockSnapshot, items: SuggestedItem[]): Promise<ShoppingList>
}

interface ShoppingListRow {
  id: string
  period: string
  status: ShoppingListStatus
}

const toShoppingList = (row: ShoppingListRow): ShoppingList => ({ id: row.id, period: row.period, status: row.status })

export function currentPeriod(today = new Date()): string {
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${today.getFullYear()}-${month}-01`
}

export function createSupabaseShoppingRepository(supabase: SupabaseClient): ShoppingRepository {
  return {
    async getOpenList(householdId) {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('id, period, status')
        .eq('household_id', householdId)
        .neq('status', 'closed')
        .maybeSingle<ShoppingListRow>()
      if (error) throw error
      return data ? toShoppingList(data) : null
    },

    async getCarryOver(householdId) {
      const { data: last, error: listError } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', householdId)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>()
      if (listError) throw listError
      if (!last) return []

      const { data, error } = await supabase
        .from('list_items')
        .select('product_id, quantity')
        .eq('list_id', last.id)
        .eq('status', 'skipped')
        .returns<{ product_id: string; quantity: number | string }[]>()
      if (error) throw error
      return data.map((row) => ({ productId: row.product_id, quantity: Number(row.quantity) }))
    },

    async createList(householdId, stock, items) {
      const { data, error } = await supabase
        .rpc('create_shopping_list', {
          p_household_id: householdId,
          p_period: currentPeriod(),
          p_stock: Object.entries(stock).map(([productId, quantity]) => ({ productId, quantity })),
          p_items: items,
        })
        .single<ShoppingListRow>()
      if (error) throw error
      return toShoppingList(data)
    },
  }
}
