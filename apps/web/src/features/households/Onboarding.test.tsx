import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BASE_CATALOG } from '@changuito/domain'
import { AppRoutes } from '@/app/AppRoutes'
import { FakeHouseholdRepository, renderWithProviders } from '@/test/fakes'

describe('Onboarding', () => {
  it('creates a household copying only the chosen catalog products', async () => {
    const households = new FakeHouseholdRepository()
    renderWithProviders(<AppRoutes />, { repositories: { households } })

    await userEvent.click(await screen.findByRole('button', { name: 'Crear un hogar' }))
    await userEvent.type(screen.getByLabelText('Nombre del hogar'), 'Casa de Juani')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await userEvent.click(screen.getByRole('checkbox', { name: 'Leche' }))
    const pets = screen.getByRole('group', { name: 'Mascotas' })
    await userEvent.click(within(pets).getByRole('checkbox', { name: 'Toda la sección Mascotas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Crear hogar' }))

    expect(await screen.findByRole('heading', { name: 'Casa de Juani' })).toBeInTheDocument()
    const [{ name, catalog }] = households.created
    const productNames = catalog.flatMap((section) => section.products.map((product) => product.name))
    const totalProducts = BASE_CATALOG.flatMap((section) => section.products).length
    expect(name).toBe('Casa de Juani')
    expect(productNames).not.toContain('Leche')
    expect(catalog.map((section) => section.name)).not.toContain('Mascotas')
    expect(productNames).toHaveLength(totalProducts - 1 - 3)
  })

  it('requires a household name before choosing products', async () => {
    renderWithProviders(<AppRoutes />, { repositories: { households: new FakeHouseholdRepository() } })

    await userEvent.click(await screen.findByRole('button', { name: 'Crear un hogar' }))

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('joins an existing household with its invite code', async () => {
    const households = new FakeHouseholdRepository()
    households.validCodes.set('ABCD2345', { id: 'h-9', name: 'Casa de mis viejos', inviteCode: 'ABCD2345', role: 'member' })
    renderWithProviders(<AppRoutes />, { repositories: { households } })

    await userEvent.click(await screen.findByRole('button', { name: 'Unirme con un código' }))
    await userEvent.type(screen.getByLabelText('Código de invitación'), 'abcd2345')
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }))

    expect(await screen.findByRole('heading', { name: 'Casa de mis viejos' })).toBeInTheDocument()
  })

  it('explains when the invite code is not valid', async () => {
    renderWithProviders(<AppRoutes />, { repositories: { households: new FakeHouseholdRepository() } })

    await userEvent.click(await screen.findByRole('button', { name: 'Unirme con un código' }))
    await userEvent.type(screen.getByLabelText('Código de invitación'), 'NOPE1234')
    await userEvent.click(screen.getByRole('button', { name: 'Unirme' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es válido. Revisa que esté bien escrito.')
  })
})
