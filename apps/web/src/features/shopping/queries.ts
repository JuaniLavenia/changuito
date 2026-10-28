import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { StockSnapshot, SuggestedItem } from '@changuito/domain'
import { useRepositories } from '@/app/repositories'

export const shoppingKeys = {
  openList: (householdId: string) => ['open-list', householdId] as const,
  carryOver: (householdId: string) => ['carry-over', householdId] as const,
}

export function useOpenList(householdId: string) {
  const { shopping } = useRepositories()
  return useQuery({ queryKey: shoppingKeys.openList(householdId), queryFn: () => shopping.getOpenList(householdId) })
}

export function useCarryOver(householdId: string) {
  const { shopping } = useRepositories()
  return useQuery({ queryKey: shoppingKeys.carryOver(householdId), queryFn: () => shopping.getCarryOver(householdId) })
}

export function useCreateList(householdId: string) {
  const { shopping } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stock, items }: { stock: StockSnapshot; items: SuggestedItem[] }) =>
      shopping.createList(householdId, stock, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.openList(householdId) }),
  })
}
