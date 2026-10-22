import { useEffect, useState } from 'react'
import { useRepositories } from '@/app/repositories'
import type { SessionUser } from './auth-repository'

type SessionState = { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: SessionUser }

const toState = (user: SessionUser | null): SessionState =>
  user ? { status: 'signed-in', user } : { status: 'signed-out' }

export function useSession(): SessionState {
  const { auth } = useRepositories()
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    auth.getUser().then((user) => {
      if (active) setState(toState(user))
    })
    const unsubscribe = auth.onChange((user) => setState(toState(user)))
    return () => {
      active = false
      unsubscribe()
    }
  }, [auth])

  return state
}
