// Runs against the local Supabase stack: `pnpm db:start`, then `pnpm --filter @changuito/web test:integration`.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseHouseholdRepository, InvalidInviteCodeError } from './household-repository'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const describeIntegration = anonKey && serviceKey ? describe : describe.skip

async function signedInClient(email: string): Promise<SupabaseClient> {
  const admin = createClient(url, serviceKey!, { auth: { persistSession: false } })
  const password = 'integration-test-password'
  await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: email } })
  const client = createClient(url, anonKey!, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

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
})
