import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { SideMenu } from './SideMenu'
import type { Household } from '@/features/households/household-repository'
import { useHouseholdStore } from '@/features/households/household-store'

interface AppShellProps {
  households: Household[]
  current: Household
  children: ReactNode
}

export const AppShell = ({ households, current, children }: AppShellProps) => {
  const selectHousehold = useHouseholdStore((state) => state.selectHousehold)

  return (
    <div className="min-h-dvh">
      {/* White on the primary green is 3.3:1, so the brand text stays large and bold (WCAG large text). */}
      <header className="sticky top-0 z-10 bg-primary pt-[env(safe-area-inset-top,0px)] text-primary-foreground shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2">
          <SideMenu />
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <ShoppingCart aria-hidden className="h-5 w-5" />
            Changuito
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {households.length > 1 && (
              <select
                aria-label="Hogar"
                className="h-9 max-w-40 rounded-md border border-input bg-card px-2 text-sm text-foreground"
                value={current.id}
                onChange={(event) => selectHousehold(event.target.value)}
              >
                {households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-[calc(var(--bottom-clearance)+2rem)] pt-6">{children}</main>
    </div>
  )
}
