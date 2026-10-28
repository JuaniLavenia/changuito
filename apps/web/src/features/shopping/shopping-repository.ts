import type { SupabaseClient } from '@supabase/supabase-js'
import type { CarryOverItem, ListItem, StockSnapshot, SuggestedItem, Unit } from '@changuito/domain'

export type ShoppingListStatus = 'draft' | 'shopping' | 'closed'

export interface ShoppingList {
  id: string
  /** First day of the month, ISO date (YYYY-MM-DD). */
  period: string
  status: ShoppingListStatus
}

/** A list item with the product fields the store walk needs. */
export interface ShoppingItem extends ListItem {
  name: string
  sectionId: string | null
  unit: Unit
  preferredBrand: string | null
  /** Display name of whoever put it in the cart. */
  checkedByName: string | null
}

export interface ShoppingRepository {
  /** The household's list that is not closed yet, if any. */
  getOpenList(householdId: string): Promise<ShoppingList | null>
  /** Items skipped on the most recently closed list, offered again this month. */
  getCarryOver(householdId: string): Promise<CarryOverItem[]>
  /** Saves the stock review and the list built from it, atomically. */
  createList(householdId: string, stock: StockSnapshot, items: SuggestedItem[]): Promise<ShoppingList>
  listItems(listId: string): Promise<ShoppingItem[]>
  /** Persists the item's status, price, brand and skip reason. */
  saveItem(item: ListItem): Promise<void>
  /** Calls `onChange` whenever someone changes an item of the list. Returns the unsubscribe function. */
  subscribeToItems(listId: string, onChange: () => void): () => void
  /** Closes the list. Fails while any item is still pending. */
  closeList(listId: string): Promise<void>
}

interface ShoppingListRow {
  id: string
  period: string
  status: ShoppingListStatus
}

interface ListItemRow {
  id: string
  product_id: string
  quantity: number | string
  status: ListItem['status']
  skip_reason: ListItem['skipReason']
  price: number | string | null
  brand: string | null
  checked_by: string | null
  products: { name: string; section_id: string | null; unit: Unit; preferred_brand: string | null }
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

    async listItems(listId) {
      const { data, error } = await supabase
        .from('list_items')
        .select(
          'id, product_id, quantity, status, skip_reason, price, brand, checked_by, products(name, section_id, unit, preferred_brand)',
        )
        .eq('list_id', listId)
        .returns<ListItemRow[]>()
      if (error) throw error

      // checked_by points at auth.users, so housemates' names come from profiles in a second query.
      const checkerIds = [...new Set(data.flatMap((row) => (row.checked_by ? [row.checked_by] : [])))]
      const names = new Map<string, string>()
      if (checkerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', checkerIds)
          .returns<{ id: string; display_name: string }[]>()
        if (profilesError) throw profilesError
        profiles.forEach((profile) => names.set(profile.id, profile.display_name))
      }

      return data.map((row) => ({
        id: row.id,
        productId: row.product_id,
        quantity: Number(row.quantity),
        status: row.status,
        skipReason: row.skip_reason,
        price: row.price === null ? null : Number(row.price),
        brand: row.brand,
        checkedBy: row.checked_by,
        name: row.products.name,
        sectionId: row.products.section_id,
        unit: row.products.unit,
        preferredBrand: row.products.preferred_brand,
        checkedByName: row.checked_by ? names.get(row.checked_by) || 'Alguien' : null,
      }))
    },

    async saveItem(item) {
      // A trigger stamps checked_by with auth.uid() when the item goes into the cart.
      const { error } = await supabase
        .from('list_items')
        .update({
          status: item.status,
          skip_reason: item.skipReason,
          price: item.price,
          brand: item.brand,
          checked_by: item.checkedBy,
        })
        .eq('id', item.id)
      if (error) throw error
    },

    subscribeToItems(listId, onChange) {
      const channel = supabase
        .channel(`list-items-${listId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` },
          () => onChange(),
        )
        .subscribe()
      return () => {
        void supabase.removeChannel(channel)
      }
    },

    async closeList(listId) {
      const { error } = await supabase.rpc('close_shopping_list', { p_list_id: listId })
      if (error) throw error
    },
  }
}
