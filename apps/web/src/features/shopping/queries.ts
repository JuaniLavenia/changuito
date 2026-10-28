import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ListItem, StockSnapshot, SuggestedItem } from '@changuito/domain'
import { useRepositories } from '@/app/repositories'

export const shoppingKeys = {
  openList: (householdId: string) => ['open-list', householdId] as const,
  carryOver: (householdId: string) => ['carry-over', householdId] as const,
  items: (listId: string) => ['list-items', listId] as const,
}

export function useListItems(listId: string) {
  const { shopping } = useRepositories()
  return useQuery({ queryKey: shoppingKeys.items(listId), queryFn: () => shopping.listItems(listId) })
}

/** Refetches the items whenever another phone changes the list. */
export function useListItemsRealtime(listId: string) {
  const { shopping } = useRepositories()
  const queryClient = useQueryClient()

  useEffect(
    () =>
      shopping.subscribeToItems(listId, () => {
        void queryClient.invalidateQueries({ queryKey: shoppingKeys.items(listId) })
      }),
    [shopping, queryClient, listId],
  )
}

/** Saves the skip reasons, then closes the list. The skipped items come back in next month's stock review. */
export function useCloseTrip(householdId: string, listId: string) {
  const { shopping } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (skipped: ListItem[]) => {
      await Promise.all(skipped.map((item) => shopping.saveItem(item)))
      await shopping.closeList(listId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shoppingKeys.openList(householdId) })
      void queryClient.invalidateQueries({ queryKey: shoppingKeys.carryOver(householdId) })
    },
    onError: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.items(listId) }),
  })
}

export function useSaveItem(listId: string) {
  const { shopping } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: ListItem) => shopping.saveItem(item),
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.items(listId) }),
  })
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
