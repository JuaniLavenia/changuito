import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import { BookOpen, ClipboardList, Home, LogOut, Menu, Plus, ShoppingCart, X, type LucideIcon } from 'lucide-react'
import { useRepositories } from './repositories'

/** Router state that lets a member open onboarding to create or join another household. */
export interface OnboardingState {
  addAnother?: boolean
}

const ADD_ANOTHER: OnboardingState = { addAnother: true }

const MENU_ROW = 'flex w-full items-center gap-3 rounded-md px-3 py-3 text-base'

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/catalogo', label: 'Catálogo', icon: BookOpen },
  { to: '/stock', label: 'Stock', icon: ClipboardList },
  { to: '/super', label: 'Súper', icon: ShoppingCart },
]

export const SideMenu = () => {
  const { auth } = useRepositories()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger
        aria-label="Abrir menú"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
      >
        <Menu aria-hidden className="h-5 w-5" />
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background pt-[env(safe-area-inset-top,0px)] shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <RadixDialog.Title className="text-lg font-semibold text-primary">Menú</RadixDialog.Title>
            <RadixDialog.Close aria-label="Cerrar menú" className="rounded-md p-1 hover:bg-accent">
              <X aria-hidden className="h-5 w-5" />
            </RadixDialog.Close>
          </div>
          <nav aria-label="Secciones" className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end
                    onClick={close}
                    className={({ isActive }) =>
                      `${MENU_ROW} ${isActive ? 'bg-accent font-medium text-primary' : 'text-foreground hover:bg-muted'}`
                    }
                  >
                    <Icon aria-hidden className="h-5 w-5" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-1 border-t border-border p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
            <Link to="/onboarding" state={ADD_ANOTHER} onClick={close} className={`${MENU_ROW} hover:bg-muted`}>
              <Plus aria-hidden className="h-5 w-5" />
              Crear o unirme a otro hogar
            </Link>
            <button
              type="button"
              onClick={() => {
                close()
                void auth.signOut()
              }}
              className={`${MENU_ROW} text-destructive hover:bg-muted`}
            >
              <LogOut aria-hidden className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
