import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import type {
  CarryOverItem,
  CatalogSection,
  ListItem,
  Product,
  Section,
  StockSnapshot,
  SuggestedItem,
} from '@changuito/domain'
import { RepositoriesProvider, type Repositories } from '@/app/repositories'
import type { AuthRepository, SessionUser } from '@/features/auth/auth-repository'
import type { CatalogRepository, ProductInput } from '@/features/catalog/catalog-repository'
import {
  InvalidInviteCodeError,
  type Household,
  type HouseholdRepository,
} from '@/features/households/household-repository'
import { useHouseholdStore } from '@/features/households/household-store'
import type { ShoppingItem, ShoppingList, ShoppingRepository } from '@/features/shopping/shopping-repository'

export const juani: SessionUser = { id: 'user-juani', name: 'Juani', avatarUrl: null }

export class FakeAuthRepository implements AuthRepository {
  user: SessionUser | null
  signInCalls = 0
  private listeners = new Set<(user: SessionUser | null) => void>()

  constructor(user: SessionUser | null = juani) {
    this.user = user
  }

  async getUser() {
    return this.user
  }

  onChange(listener: (user: SessionUser | null) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async signInWithGoogle() {
    this.signInCalls++
  }

  async signOut() {
    this.user = null
    this.listeners.forEach((listener) => listener(null))
  }
}

export class FakeHouseholdRepository implements HouseholdRepository {
  households: Household[]
  created: { name: string; catalog: CatalogSection[] }[] = []
  validCodes = new Map<string, Household>()

  constructor(households: Household[] = []) {
    this.households = households
  }

  async list() {
    return this.households
  }

  async create(name: string, catalog: CatalogSection[]) {
    this.created.push({ name, catalog })
    const household: Household = { id: `h-${this.households.length + 1}`, name, inviteCode: 'ABCD2345', role: 'admin' }
    this.households = [...this.households, household]
    return household
  }

  async join(code: string) {
    const household = this.validCodes.get(code.trim().toUpperCase())
    if (!household) throw new InvalidInviteCodeError()
    this.households = [...this.households, household]
    return household
  }

  async regenerateCode(householdId: string) {
    const code = 'NEWC0DE9'
    this.households = this.households.map((h) => (h.id === householdId ? { ...h, inviteCode: code } : h))
    return code
  }
}

export const casa: Household = { id: 'h-1', name: 'Casa', inviteCode: 'ABCD2345', role: 'admin' }

export const sections: Section[] = [
  { id: 's-dairy', name: 'Lácteos', sortOrder: 2 },
  { id: 's-pantry', name: 'Almacén', sortOrder: 1 },
]

export const product = (overrides: Partial<Product> & Pick<Product, 'id' | 'name'>): Product => ({
  sectionId: 's-pantry',
  unit: 'unit',
  preferredBrand: null,
  expectedMonthlyConsumption: 1,
  ...overrides,
})

export class FakeCatalogRepository implements CatalogRepository {
  sections: Section[]
  products: Product[]
  private nextId = 1

  constructor(products: Product[] = [], sectionList: Section[] = sections) {
    this.products = products
    this.sections = sectionList
  }

  async listSections() {
    return this.sections
  }

  async listProducts() {
    return this.products
  }

  async createProduct(_householdId: string, input: ProductInput) {
    const created = { id: `p-new-${this.nextId++}`, ...input }
    this.products = [...this.products, created]
    return created
  }

  async updateProduct(productId: string, input: ProductInput) {
    const updated = { id: productId, ...input }
    this.products = this.products.map((p) => (p.id === productId ? updated : p))
    return updated
  }

  async archiveProduct(productId: string) {
    this.products = this.products.filter((p) => p.id !== productId)
  }

  async createSection(_householdId: string, name: string) {
    const section = { id: `s-new-${this.nextId++}`, name, sortOrder: this.sections.length + 1 }
    this.sections = [...this.sections, section]
    return section
  }
}

export const shoppingItem = (
  overrides: Partial<ShoppingItem> & Pick<ShoppingItem, 'id' | 'productId' | 'name'>,
): ShoppingItem => ({
  quantity: 1,
  status: 'pending',
  skipReason: null,
  price: null,
  brand: null,
  checkedBy: null,
  sectionId: 's-pantry',
  unit: 'unit',
  preferredBrand: null,
  checkedByName: null,
  ...overrides,
})

const USER_NAMES: Record<string, string> = { [juani.id]: juani.name }

export class FakeShoppingRepository implements ShoppingRepository {
  openList: ShoppingList | null
  carryOver: CarryOverItem[]
  items: ShoppingItem[]
  createdLists: { stock: StockSnapshot; items: SuggestedItem[] }[] = []
  savedItems: ListItem[] = []
  closedLists: string[] = []
  failClose = false
  private listeners = new Set<() => void>()

  constructor({
    openList = null,
    carryOver = [],
    items = [],
  }: { openList?: ShoppingList | null; carryOver?: CarryOverItem[]; items?: ShoppingItem[] } = {}) {
    this.openList = openList
    this.carryOver = carryOver
    this.items = items
  }

  async getOpenList() {
    return this.openList
  }

  async getCarryOver() {
    return this.carryOver
  }

  async createList(_householdId: string, stock: StockSnapshot, items: SuggestedItem[]) {
    this.createdLists.push({ stock, items })
    this.openList = { id: 'list-1', period: '2026-11-01', status: 'draft' }
    return this.openList
  }

  async listItems() {
    return this.items
  }

  async saveItem(item: ListItem) {
    this.savedItems.push(item)
    this.items = this.items.map((existing) =>
      existing.id === item.id
        ? { ...existing, ...item, checkedByName: item.checkedBy ? (USER_NAMES[item.checkedBy] ?? null) : null }
        : existing,
    )
  }

  subscribeToItems(_listId: string, onChange: () => void) {
    this.listeners.add(onChange)
    return () => {
      this.listeners.delete(onChange)
    }
  }

  async closeList(listId: string) {
    if (this.failClose) throw new Error('close failed')
    if (this.items.some((item) => item.status === 'pending')) throw new Error('pending items')
    this.closedLists.push(listId)
    this.openList = null
  }

  /** Simulates another phone changing an item. */
  emitRemoteChange(item: ShoppingItem) {
    this.items = this.items.map((existing) => (existing.id === item.id ? item : existing))
    this.listeners.forEach((listener) => listener())
  }
}

export function renderWithProviders(
  ui: ReactNode,
  { repositories, path = '/' }: { repositories: Partial<Repositories>; path?: string },
) {
  useHouseholdStore.setState({ currentHouseholdId: null })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const repos: Repositories = {
    auth: new FakeAuthRepository(),
    households: new FakeHouseholdRepository(),
    catalog: new FakeCatalogRepository(),
    shopping: new FakeShoppingRepository(),
    ...repositories,
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <RepositoriesProvider value={repos}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </RepositoriesProvider>
    </QueryClientProvider>,
  )
}
