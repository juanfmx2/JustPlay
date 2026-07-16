import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

interface AuthUser {
  id: string
  email: string
  name?: string
}

interface AuthSession {
  id: string
  userId: string
}

interface AuthSessionResponse {
  user?: AuthUser
  session?: AuthSession
}

interface AuthSessionContextValue {
  user: AuthUser | null
  session: AuthSession | null
  isLoading: boolean
  refreshSession: () => Promise<void>
  signOut: () => Promise<boolean>
}

const defaultValue: AuthSessionContextValue = {
  user: null,
  session: null,
  isLoading: false,
  refreshSession: async () => {},
  signOut: async () => false,
}

const AuthSessionContext = createContext<AuthSessionContextValue>(defaultValue)

const parseSessionPayload = (payload: unknown): { user: AuthUser | null; session: AuthSession | null } => {
  const data = payload as AuthSessionResponse | null

  if (!data || !data.user || !data.session) {
    return { user: null, session: null }
  }

  return {
    user: data.user,
    session: data.session,
  }
}

export const AuthSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/get-session', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        setUser(null)
        setSession(null)
        return
      }

      const payload = await response.json()
      const nextState = parseSessionPayload(payload)
      setUser(nextState.user)
      setSession(nextState.session)
    } catch {
      setUser(null)
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        return false
      }

      setUser(null)
      setSession(null)
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadSession = async () => {
      if (!active) {
        return
      }

      await refreshSession()
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [refreshSession])

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      refreshSession,
      signOut,
    }),
    [isLoading, refreshSession, session, signOut, user],
  )

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export const useAuthSession = () => useContext(AuthSessionContext)
