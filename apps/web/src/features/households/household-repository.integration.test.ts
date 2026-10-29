// Runs against the local Supabase stack: `pnpm db:start`, then `pnpm --filter @changuito/web test:integration`.
import { anonymousClient, describeIntegration, signedInClient } from '@/test/integration'
import { createSupabaseHouseholdRepository, InvalidInviteCodeError, NotSignedInError } from './household-repository'

describeIntegration('Supabase household repository', () => {
  const run = Date.now()

  it('creates a household with its catalog and lets a relative join with the code', async () => {
    const owner = createSupabaseHouseholdRepository(await signedInClient(`owner-${run}@example.com`))
    const relative = createSupabaseHouseholdRepository(await signedInClient(`relative-${run}@example.com`))

    const created = await owner.create('Casa', [
      { name: 'Lácteos', products: [{ name: 'Leche', unit: 'l', expected: 8 }] },
    ])
    expect(created).toMatchObject({ name: 'Casa', role: 'admin' })
    expect(created.inviteCode).toMatch(/^[A-Z2-9]{8}$/)

    const joined = await relative.join(created.inviteCode.toLowerCase())
    expect(joined).toMatchObject({ id: created.id, role: 'member' })
    expect(await relative.list()).toEqual([joined])
    expect(await owner.list()).toEqual([created])

    const newCode = await owner.regenerateCode(created.id)
    expect(newCode).not.toBe(created.inviteCode)
    await expect(relative.regenerateCode(created.id)).rejects.toThrow()
  })

  it('maps an unknown invite code to InvalidInviteCodeError', async () => {
    const stranger = createSupabaseHouseholdRepository(await signedInClient(`stranger-${run}@example.com`))

    await expect(stranger.join('ZZZZZZZZ')).rejects.toBeInstanceOf(InvalidInviteCodeError)
  })

  it('fails instead of reporting no households when there is no signed-in user', async () => {
    const signedOut = createSupabaseHouseholdRepository(anonymousClient())

    await expect(signedOut.list()).rejects.toBeInstanceOf(NotSignedInError)
  })
})
