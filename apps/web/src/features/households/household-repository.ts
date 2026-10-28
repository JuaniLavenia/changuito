import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogSection } from '@changuito/domain'

export type HouseholdRole = 'admin' | 'member'

export interface Household {
  id: string
  name: string
  inviteCode: string
  role: HouseholdRole
}

export class InvalidInviteCodeError extends Error {
  constructor() {
    super('Invalid invite code')
    this.name = 'InvalidInviteCodeError'
  }
}

export interface HouseholdRepository {
  /** Households the current user belongs to. */
  list(): Promise<Household[]>
  create(name: string, catalog: CatalogSection[]): Promise<Household>
  join(inviteCode: string): Promise<Household>
  regenerateCode(householdId: string): Promise<string>
}

interface HouseholdRow {
  id: string
  name: string
  invite_code: string
}

const toHousehold = (row: HouseholdRow, role: HouseholdRole): Household => ({
  id: row.id,
  name: row.name,
  inviteCode: row.invite_code,
  role,
})

// Postgres "no_data_found", raised by join_household for unknown codes.
const NOT_FOUND = 'P0002'

export function createSupabaseHouseholdRepository(supabase: SupabaseClient): HouseholdRepository {
  return {
    async list() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return []

      // RLS also returns housemates' memberships, so filter to the caller's rows.
      const { data, error } = await supabase
        .from('household_members')
        .select('role, household:households!inner(id, name, invite_code)')
        .eq('user_id', auth.user.id)
        .order('joined_at')
        .returns<{ role: HouseholdRole; household: HouseholdRow }[]>()
      if (error) throw error
      return data.map((row) => toHousehold(row.household, row.role))
    },

    async create(name, catalog) {
      const { data, error } = await supabase
        .rpc('create_household', { p_name: name, p_catalog: catalog })
        .single<HouseholdRow>()
      if (error) throw error
      return toHousehold(data, 'admin')
    },

    async join(inviteCode) {
      const { data, error } = await supabase
        .rpc('join_household', { p_invite_code: inviteCode })
        .single<HouseholdRow>()
      if (error?.code === NOT_FOUND) throw new InvalidInviteCodeError()
      if (error) throw error
      return toHousehold(data, 'member')
    },

    async regenerateCode(householdId) {
      const { data, error } = await supabase.rpc('regenerate_invite_code', { p_household_id: householdId })
      if (error) throw error
      return data as string
    },
  }
}
