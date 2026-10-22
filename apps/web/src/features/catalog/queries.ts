import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/app/repositories'
import type { ProductInput } from './catalog-repository'

export const catalogKeys = {
  sections: (householdId: string) => ['sections', householdId] as const,
  products: (householdId: string) => ['products', householdId] as const,
}

export function useSections(householdId: string) {
  const { catalog } = useRepositories()
  return useQuery({ queryKey: catalogKeys.sections(householdId), queryFn: () => catalog.listSections(householdId) })
}

export function useProducts(householdId: string) {
  const { catalog } = useRepositories()
  return useQuery({ queryKey: catalogKeys.products(householdId), queryFn: () => catalog.listProducts(householdId) })
}

interface SaveProductInput {
  productId?: string
  input: ProductInput
  /** When set, the section is created first and the product is placed in it. */
  newSectionName?: string
}

export function useSaveProduct(householdId: string) {
  const { catalog } = useRepositories()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ productId, input, newSectionName }: SaveProductInput) => {
      const sectionId = newSectionName
        ? (await catalog.createSection(householdId, newSectionName)).id
        : input.sectionId
      const withSection = { ...input, sectionId }
      return productId
        ? catalog.updateProduct(productId, withSection)
        : catalog.createProduct(householdId, withSection)
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogKeys.products(householdId) }),
        queryClient.invalidateQueries({ queryKey: catalogKeys.sections(householdId) }),
      ]),
  })
}

export function useArchiveProduct(householdId: string) {
  const { catalog } = useRepositories()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (productId: string) => catalog.archiveProduct(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.products(householdId) }),
  })
}
