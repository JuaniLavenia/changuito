import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoutes } from '@/app/AppRoutes'
import type { ClosedTripSummary } from '@/features/shopping/shopping-repository'
import { formatPrice } from '@/lib/format'
import {
  casa,
  FakeHouseholdRepository,
  FakeShoppingRepository,
  renderWithProviders,
  shoppingItem,
} from '@/test/fakes'

const openList = { id: 'list-1', period: '2026-11-01', status: 'draft' as const }
const milk = shoppingItem({ id: 'i-milk', productId: 'p-milk', name: 'Leche', unit: 'l', quantity: 6 })
const rice = shoppingItem({ id: 'i-rice', productId: 'p-rice', name: 'Arroz', unit: 'kg', quantity: 2 })

const renderHome = (shopping = new FakeShoppingRepository()) =>
  renderWithProviders(<AppRoutes />, {
    repositories: { households: new FakeHouseholdRepository([casa]), shopping },
  })

const monthCard = async () => screen.findByRole('region', { name: 'Este mes' })

describe('HomePage summary', () => {
  it('points to the stock review when this month has no list yet', async () => {
    renderHome()

    const card = await monthCard()
    expect(await within(card).findByText('Todavía no revisaron el stock este mes.')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Revisar stock' })).toHaveAttribute('href', '/stock')
  })

  it('points to the store when the list is ready', async () => {
    renderHome(new FakeShoppingRepository({ openList, items: [milk, rice] }))

    const card = await monthCard()
    expect(await within(card).findByText('La lista de este mes está lista: 2 productos.')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Ir al súper' })).toHaveAttribute('href', '/super')
  })

  it('shows the shopping progress and what has been spent so far', async () => {
    const inCart = { ...milk, status: 'in_cart' as const, price: 1200 }
    renderHome(new FakeShoppingRepository({ openList, items: [inCart, rice] }))

    const card = await monthCard()
    expect(await within(card).findByText('1 de 2 en el carrito')).toBeInTheDocument()
    // Testing Library collapses the non-breaking space formatPrice puts after "$".
    expect(within(card).getByText(`Llevan gastado ${formatPrice(7200)}`.replace(/\s+/g, ' '))).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/super')
  })

  it('reminds what was left pending last month while there is no new list', async () => {
    renderHome(
      new FakeShoppingRepository({
        carryOver: [
          { productId: 'p-oil', quantity: 1 },
          { productId: 'p-rice', quantity: 2 },
        ],
      }),
    )

    expect(
      await screen.findByText(
        '2 productos quedaron pendientes del mes pasado. Te los vamos a ofrecer al revisar el stock.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the spending of past trips and how the last one compares with the one before', async () => {
    const closedTrips: ClosedTripSummary[] = [
      { id: 'l-oct', period: '2026-10-01', total: 120_000, boughtCount: 30 },
      { id: 'l-sep', period: '2026-09-01', total: 100_000, boughtCount: 28 },
    ]
    renderHome(new FakeShoppingRepository({ closedTrips }))

    const history = await screen.findByRole('region', { name: 'Historial de gasto' })
    expect(within(history).getByText('20% más que la compra anterior')).toBeInTheDocument()
    const rows = within(history).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      `octubre de 2026${formatPrice(120_000)}`,
      `septiembre de 2026${formatPrice(100_000)}`,
    ])
  })

  it('does not show a history before the first trip is closed', async () => {
    renderHome()

    await monthCard()
    expect(screen.queryByRole('region', { name: 'Historial de gasto' })).not.toBeInTheDocument()
  })
})

describe('HomePage invite code', () => {
  it('keeps the invite code folded until asked for', async () => {
    renderHome()

    const toggle = await screen.findByRole('button', { name: 'Código de invitación' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('ABCD2345')).not.toBeInTheDocument()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('ABCD2345')).toBeInTheDocument()
  })
})
