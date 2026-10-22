import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './app/AppRoutes'
import { RepositoriesProvider, type Repositories } from './app/repositories'
import { createSupabaseAuthRepository } from './features/auth/auth-repository'
import { createSupabaseCatalogRepository } from './features/catalog/catalog-repository'
import { createSupabaseHouseholdRepository } from './features/households/household-repository'
import { queryClient } from './lib/queryClient'
import { supabase } from './lib/supabase'

const repositories: Repositories = {
  auth: createSupabaseAuthRepository(supabase),
  households: createSupabaseHouseholdRepository(supabase),
  catalog: createSupabaseCatalogRepository(supabase),
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoriesProvider value={repositories}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </RepositoriesProvider>
    </QueryClientProvider>
  )
}
