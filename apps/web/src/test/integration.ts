import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Integration suites run only when the local Supabase keys are exported. */
export const describeIntegration = anonKey && serviceKey ? describe : describe.skip

export async function signedInClient(email: string): Promise<SupabaseClient> {
  const admin = createClient(url, serviceKey!, { auth: { persistSession: false } })
  const password = 'integration-test-password'
  await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: email } })
  const client = createClient(url, anonKey!, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}
