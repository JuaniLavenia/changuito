import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoutes } from '@/app/AppRoutes'
import {
  casa,
  FakeHouseholdRepository,
  FakeShoppingRepository,
  renderWithProviders,
  shoppingItem,
} from '@/test/fakes'

const openList = { id: 'list-1', period: '2026-11-01', status: 'draft' as const }
const milk = shoppingItem({ id: 'i-milk', productId: 'p-milk', name: 'Leche', sectionId: 's-dairy', unit: 'l', quantity: 6 })
const rice = shoppingItem({
  id: 'i-rice',
  productId: 'p-rice',
  name: 'Arroz',
  sectionId: 's-pantry',
  unit: 'kg',
  quantity: 2,
  preferredBrand: 'Gallo',
})

const renderShopping = (shopping = new FakeShoppingRepository({ openList, items: [milk, rice] })) =>
  renderWithProviders(<AppRoutes />, {
    path: '/super',
    repositories: { households: new FakeHouseholdRepository([casa]), shopping },
  })

describe('ShoppingPage', () => {
  it('lists the items in store order, by section', async () => {
    renderShopping()

    const sectionHeadings = await screen.findAllByRole('heading', { level: 2 })
    expect(sectionHeadings.map((heading) => heading.textContent)).toEqual(['Almacén', 'Lácteos'])
    expect(within(screen.getByRole('listitem', { name: 'Leche' })).getByText('6 litros')).toBeInTheDocument()
    expect(screen.getByText('0 de 2 en el carrito')).toBeInTheDocument()
  })

  it('records the price and an optional brand when an item goes into the cart', async () => {
    const shopping = new FakeShoppingRepository({ openList, items: [milk, rice] })
    renderShopping(shopping)

    await userEvent.click(await screen.findByRole('button', { name: 'Tachar Arroz' }))
    const dialog = screen.getByRole('dialog', { name: 'Tachar Arroz' })
    expect(within(dialog).getByLabelText('Marca (opcional)')).toHaveValue('Gallo')
    await userEvent.type(within(dialog).getByLabelText('Precio por unidad'), '1250,50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Al carrito' }))

    const item = await screen.findByRole('listitem', { name: 'Arroz' })
    expect(await within(item).findByText('Lo tachó Juani · Gallo · $ 1.250,50')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 en el carrito')).toBeInTheDocument()
    expect(shopping.savedItems).toEqual([
      expect.objectContaining({ id: 'i-rice', status: 'in_cart', price: 1250.5, brand: 'Gallo', checkedBy: 'user-juani' }),
    ])
  })

  it('puts an item back on the list when it is unchecked', async () => {
    const inCart = { ...milk, status: 'in_cart' as const, price: 900, checkedBy: 'user-juani', checkedByName: 'Juani' }
    const shopping = new FakeShoppingRepository({ openList, items: [inCart, rice] })
    renderShopping(shopping)

    await userEvent.click(await screen.findByRole('button', { name: 'Destachar Leche' }))

    expect(await screen.findByRole('button', { name: 'Tachar Leche' })).toBeInTheDocument()
    expect(shopping.savedItems).toEqual([
      expect.objectContaining({ id: 'i-milk', status: 'pending', price: null, brand: null, checkedBy: null }),
    ])
  })

  it('shows check-offs made from another phone as they happen', async () => {
    const shopping = new FakeShoppingRepository({ openList, items: [milk, rice] })
    renderShopping(shopping)
    await screen.findByRole('button', { name: 'Tachar Leche' })

    shopping.emitRemoteChange({ ...milk, status: 'in_cart', price: null, checkedBy: 'user-papa', checkedByName: 'Papá' })

    const item = await screen.findByRole('listitem', { name: 'Leche' })
    expect(await within(item).findByText('Lo tachó Papá')).toBeInTheDocument()
    expect(within(item).getByRole('button', { name: 'Destachar Leche' })).toBeInTheDocument()
  })

  it('sends to the stock review when there is no list yet', async () => {
    renderShopping(new FakeShoppingRepository())

    expect(await screen.findByText('Todavía no tienen la lista de este mes.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revisar stock' })).toHaveAttribute('href', '/stock')
  })
})

describe('ShoppingPage, closing the trip', () => {
  const boughtMilk = { ...milk, status: 'in_cart' as const, price: 900, checkedBy: 'user-juani', checkedByName: 'Juani' }
  const oil = shoppingItem({ id: 'i-oil', productId: 'p-oil', name: 'Aceite', quantity: 2, unit: 'l' })

  it('asks why each item was not bought, then closes the list', async () => {
    const shopping = new FakeShoppingRepository({ openList, items: [boughtMilk, rice, oil] })
    renderShopping(shopping)

    await userEvent.click(await screen.findByRole('button', { name: 'Terminar compra' }))
    const close = screen.getByRole('button', { name: 'Cerrar compra' })
    expect(close).toBeDisabled()

    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Arroz' })).getByRole('radio', { name: 'No había' }))
    expect(close).toBeDisabled()
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Aceite' })).getByRole('radio', { name: 'Estaba caro' }),
    )
    await userEvent.click(close)

    expect(await screen.findByText('Compra cerrada')).toBeInTheDocument()
    // 6 litres at a unit price of $900.
    expect(screen.getByText('Compraste 1 producto por $ 5.400,00.')).toBeInTheDocument()
    expect(screen.getByText('2 productos quedan para la lista del mes que viene.')).toBeInTheDocument()
    expect(shopping.savedItems).toEqual([
      expect.objectContaining({ id: 'i-rice', status: 'skipped', skipReason: 'unavailable' }),
      expect.objectContaining({ id: 'i-oil', status: 'skipped', skipReason: 'too_expensive' }),
    ])
    expect(shopping.closedLists).toEqual(['list-1'])
  })

  it('closes right away when everything is in the cart', async () => {
    const shopping = new FakeShoppingRepository({ openList, items: [boughtMilk] })
    renderShopping(shopping)

    await userEvent.click(await screen.findByRole('button', { name: 'Terminar compra' }))
    expect(screen.getByText('Todo está en el carrito.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar compra' }))

    expect(await screen.findByText('Compra cerrada')).toBeInTheDocument()
    expect(screen.queryByText(/quedan? para la lista/)).not.toBeInTheDocument()
    expect(shopping.closedLists).toEqual(['list-1'])
  })

  it('keeps the list open and says so when closing fails', async () => {
    const shopping = new FakeShoppingRepository({ openList, items: [boughtMilk] })
    shopping.failClose = true
    renderShopping(shopping)

    await userEvent.click(await screen.findByRole('button', { name: 'Terminar compra' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar compra' }))

    expect(await screen.findByText('No pudimos cerrar la compra. Inténtalo de nuevo.')).toBeInTheDocument()
    expect(screen.queryByText('Compra cerrada')).not.toBeInTheDocument()
  })
})
