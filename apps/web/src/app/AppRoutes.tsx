import { Navigate, Route, Routes } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { LoginPage } from '@/features/auth/LoginPage'
import { useSession } from '@/features/auth/useSession'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { ShoppingPage } from '@/features/shopping/ShoppingPage'
import { StockReviewPage } from '@/features/stock/StockReviewPage'
import { HomePage } from '@/features/households/HomePage'
import { OnboardingPage } from '@/features/households/OnboardingPage'
import { useCurrentHousehold, useHouseholds } from '@/features/households/queries'
import { AppShell } from './AppShell'

export const AppRoutes = () => {
  const session = useSession()

  if (session.status === 'loading') return <FullPageSpinner />
  if (session.status === 'signed-out') return <LoginPage />
  return <SignedInRoutes />
}


const SignedInRoutes = () => {
  const households = useHouseholds()
  const current = useCurrentHousehold()

  if (households.isPending) return <FullPageSpinner />
  if (households.isError) {
    return (
      <div className="mx-auto max-w-sm p-4">
        <ErrorMessage>No pudimos cargar tus hogares. Revisa tu conexión y recarga la página.</ErrorMessage>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/*"
        element={
          current ? (
            <AppShell households={households.data} current={current}>
              <Routes>
                <Route index element={<HomePage household={current} />} />
                <Route path="catalogo" element={<CatalogPage household={current} />} />
                <Route path="stock" element={<StockReviewPage household={current} />} />
                <Route path="super" element={<ShoppingPage household={current} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />
    </Routes>
  )
}
