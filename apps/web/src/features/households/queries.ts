import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CatalogSection } from '@changuito/domain'
import { useRepositories } from '@/app/repositories'
import type { Household } from './household-repository'
import { useHouseholdStore } from './household-store'

export const householdKeys = {
  all: ['households'] as const,
}

export function useHouseholds() {
  const { households } = useRepositories()
  return useQuery({ queryKey: householdKeys.all, queryFn: () => households.list() })
}

/** The selected household, falling back to the first one when the stored id is gone. */
export function useCurrentHousehold(): Household | undefined {
  const { data } = useHouseholds()
  const currentId = useHouseholdStore((state) => state.currentHouseholdId)
  return data?.find((household) => household.id === currentId) ?? data?.[0]
}

function useEnterHousehold() {
  const queryClient = useQueryClient()
  const selectHousehold = useHouseholdStore((state) => state.selectHousehold)

  return (household: Household) => {
    // Add it to the cache right away so navigating home never sees a stale empty list.
    queryClient.setQueryData<Household[]>(householdKeys.all, (previous = []) =>
      previous.some((h) => h.id === household.id) ? previous : [...previous, household],
    )
    selectHousehold(household.id)
  }
}

export function useCreateHousehold() {
  const { households } = useRepositories()
  const queryClient = useQueryClient()
  const enter = useEnterHousehold()
  return useMutation({
    mutationFn: ({ name, catalog }: { name: string; catalog: CatalogSection[] }) => households.create(name, catalog),
    onSuccess: (household) => {
      enter(household)
      return queryClient.invalidateQueries({ queryKey: householdKeys.all })
    },
  })
}

export function useJoinHousehold() {
  const { households } = useRepositories()
  const queryClient = useQueryClient()
  const enter = useEnterHousehold()
  return useMutation({
    mutationFn: (inviteCode: string) => households.join(inviteCode),
    onSuccess: (household) => {
      enter(household)
      return queryClient.invalidateQueries({ queryKey: householdKeys.all })
    },
  })
}

export function useRegenerateInviteCode() {
  const { households } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (householdId: string) => households.regenerateCode(householdId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: householdKeys.all }),
  })
}
