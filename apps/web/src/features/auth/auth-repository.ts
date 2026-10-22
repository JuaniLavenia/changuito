import type { SupabaseClient, User } from '@supabase/supabase-js'

export interface SessionUser {
  id: string
  name: string
  avatarUrl: string | null
}

export interface AuthRepository {
  getUser(): Promise<SessionUser | null>
  /** Subscribes to sign-in / sign-out. Returns the unsubscribe function. */
  onChange(listener: (user: SessionUser | null) => void): () => void
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
}

function toSessionUser(user: User | null | undefined): SessionUser | null {
  if (!user) return null
  const metadata = user.user_metadata ?? {}
  return {
    id: user.id,
    name: metadata.full_name ?? metadata.name ?? user.email ?? '',
    avatarUrl: metadata.avatar_url ?? null,
  }
}

export function createSupabaseAuthRepository(supabase: SupabaseClient): AuthRepository {
  return {
    async getUser() {
      const { data } = await supabase.auth.getSession()
      return toSessionUser(data.session?.user)
    },
    onChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(toSessionUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    },
    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }
}
