import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface HouseholdState {
  currentHouseholdId: string | null
  selectHousehold: (id: string) => void
}

/** Remembers which household the user last worked in on this device. */
export const useHouseholdStore = create<HouseholdState>()(
  persist(
    (set) => ({
      currentHouseholdId: null,
      selectHousehold: (id) => set({ currentHouseholdId: id }),
    }),
    { name: 'changuito-household' }
  )
)
