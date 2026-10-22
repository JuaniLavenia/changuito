import { createContext, use } from 'react'
import type { AuthRepository } from '@/features/auth/auth-repository'
import type { HouseholdRepository } from '@/features/households/household-repository'

/** Ports the UI depends on. Supabase adapters in production, in-memory fakes in tests. */
export interface Repositories {
  auth: AuthRepository
  households: HouseholdRepository
}

const RepositoriesContext = createContext<Repositories | null>(null)

export const RepositoriesProvider = RepositoriesContext.Provider

export function useRepositories(): Repositories {
  const repositories = use(RepositoriesContext)
  if (!repositories) throw new Error('useRepositories must be used inside RepositoriesProvider')
  return repositories
}
