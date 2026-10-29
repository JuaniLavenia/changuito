import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoutes } from './AppRoutes'
import { FakeAuthRepository, FakeHouseholdRepository, renderWithProviders } from '@/test/fakes'

describe('AppRoutes', () => {
  it('asks a signed-out visitor to sign in with Google', async () => {
    const auth = new FakeAuthRepository(null)
    renderWithProviders(<AppRoutes />, { repositories: { auth } })

    await userEvent.click(await screen.findByRole('button', { name: 'Continuar con Google' }))

    expect(auth.signInCalls).toBe(1)
  })

  it('sends a user without households to onboarding', async () => {
    renderWithProviders(<AppRoutes />, { repositories: { households: new FakeHouseholdRepository() } })

    expect(await screen.findByRole('heading', { name: '¡Bienvenido a Changuito!' })).toBeInTheDocument()
  })

  it('tells the user their household is loading', async () => {
    const households = new FakeHouseholdRepository()
    households.list = () => new Promise(() => {})
    renderWithProviders(<AppRoutes />, { repositories: { households } })

    expect(await screen.findByText('Cargando tu hogar…')).toBeInTheDocument()
  })

  it('takes a member who lands on onboarding back to their household', async () => {
    const households = new FakeHouseholdRepository([
      { id: 'h-1', name: 'Casa', inviteCode: 'ABCD2345', role: 'member' },
    ])
    renderWithProviders(<AppRoutes />, { repositories: { households }, path: '/onboarding' })

    expect(await screen.findByRole('heading', { name: 'Casa' })).toBeInTheDocument()
  })

  it('still lets a member open onboarding to add another household', async () => {
    const households = new FakeHouseholdRepository([
      { id: 'h-1', name: 'Casa', inviteCode: 'ABCD2345', role: 'member' },
    ])
    renderWithProviders(<AppRoutes />, { repositories: { households } })

    await userEvent.click(await screen.findByRole('link', { name: 'Crear o unirme a otro hogar' }))

    expect(await screen.findByRole('heading', { name: '¡Bienvenido a Changuito!' })).toBeInTheDocument()
  })

  it('shows the household home with its invite code to a member', async () => {
    const households = new FakeHouseholdRepository([
      { id: 'h-1', name: 'Casa', inviteCode: 'ABCD2345', role: 'member' },
    ])
    renderWithProviders(<AppRoutes />, { repositories: { households } })

    expect(await screen.findByRole('heading', { name: 'Casa' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Código de invitación' }))
    expect(screen.getByText('ABCD2345')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generar código nuevo' })).not.toBeInTheDocument()
  })

  it('lets the admin regenerate the invite code', async () => {
    const households = new FakeHouseholdRepository([
      { id: 'h-1', name: 'Casa', inviteCode: 'ABCD2345', role: 'admin' },
    ])
    renderWithProviders(<AppRoutes />, { repositories: { households } })

    await userEvent.click(await screen.findByRole('button', { name: 'Código de invitación' }))
    await userEvent.click(screen.getByRole('button', { name: 'Generar código nuevo' }))

    expect(await screen.findByText('NEWC0DE9')).toBeInTheDocument()
  })
})
