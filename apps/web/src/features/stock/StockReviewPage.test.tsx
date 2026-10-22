import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoutes } from '@/app/AppRoutes'
import {
  casa,
  FakeCatalogRepository,
  FakeHouseholdRepository,
  FakeShoppingRepository,
  product,
  renderWithProviders,
} from '@/test/fakes'

const milk = product({ id: 'p-milk', name: 'Leche', sectionId: 's-dairy', unit: 'l', expectedMonthlyConsumption: 8 })
const rice = product({ id: 'p-rice', name: 'Arroz', sectionId: 's-pantry', unit: 'kg', expectedMonthlyConsumption: 2 })
const oil = product({ id: 'p-oil', name: 'Aceite', sectionId: 's-pantry', unit: 'l', expectedMonthlyConsumption: 0 })

const renderStock = (shopping = new FakeShoppingRepository(), products = [milk, rice]) =>
  renderWithProviders(<AppRoutes />, {
    path: '/stock',
    repositories: {
      households: new FakeHouseholdRepository([casa]),
      catalog: new FakeCatalogRepository(products),
      shopping,
    },
  })

describe('StockReviewPage', () => {
  it('suggests how much to buy as the remaining stock is entered', async () => {
    renderStock()

    const row = await screen.findByRole('group', { name: 'Leche' })
    expect(within(row).getByText('Comprar 8 litros')).toBeInTheDocument()

    await userEvent.type(within(row).getByLabelText('¿Cuánto queda de Leche?'), '3')
    expect(within(row).getByText('Comprar 5 litros')).toBeInTheDocument()

    await userEvent.clear(within(row).getByLabelText('¿Cuánto queda de Leche?'))
    await userEvent.type(within(row).getByLabelText('¿Cuánto queda de Leche?'), '9')
    expect(within(row).getByText('No hace falta')).toBeInTheDocument()
  })

  it('leaves out of the list products with enough stock', async () => {
    renderStock()

    await userEvent.type(await screen.findByLabelText('¿Cuánto queda de Arroz?'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la lista (1 producto)' }))

    const list = screen.getByRole('list', { name: 'Lista sugerida' })
    expect(within(list).getByText('Leche')).toBeInTheDocument()
    expect(within(list).queryByText('Arroz')).not.toBeInTheDocument()
  })

  it('offers again what was skipped last month', async () => {
    renderStock(new FakeShoppingRepository({ carryOver: [{ productId: 'p-oil', quantity: 2 }] }), [milk, oil])

    await userEvent.click(await screen.findByRole('button', { name: 'Ver la lista (2 productos)' }))

    const item = within(screen.getByRole('list', { name: 'Lista sugerida' })).getByRole('listitem', { name: 'Aceite' })
    expect(within(item).getByText('Quedó del mes pasado')).toBeInTheDocument()
    expect(within(item).getByLabelText('Cantidad de Aceite')).toHaveValue('2')
  })

  it('saves the review and the edited list', async () => {
    const shopping = new FakeShoppingRepository()
    renderStock(shopping)

    await userEvent.type(await screen.findByLabelText('¿Cuánto queda de Leche?'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Ver la lista (2 productos)' }))
    const list = screen.getByRole('list', { name: 'Lista sugerida' })
    await userEvent.clear(within(list).getByLabelText('Cantidad de Leche'))
    await userEvent.type(within(list).getByLabelText('Cantidad de Leche'), '6')
    await userEvent.click(within(list).getByRole('button', { name: 'Quitar Arroz' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar lista' }))

    expect(await screen.findByText('Ya tienen la lista de este mes.')).toBeInTheDocument()
    expect(shopping.createdLists).toEqual([
      {
        stock: { 'p-milk': 3, 'p-rice': 0 },
        items: [{ productId: 'p-milk', quantity: 6, carriedOver: false }],
      },
    ])
  })

  it('does not start a new review while this month list is still open', async () => {
    renderStock(new FakeShoppingRepository({ openList: { id: 'list-1', period: '2026-11-01', status: 'shopping' } }))

    expect(await screen.findByText('Ya tienen la lista de este mes.')).toBeInTheDocument()
    expect(screen.queryByLabelText('¿Cuánto queda de Leche?')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al súper' })).toHaveAttribute('href', '/super')
  })
})
