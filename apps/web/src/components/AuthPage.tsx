import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthSession } from '../hooks/useAuthSession'
import '../styles/auth.css'

type AuthMode = 'login' | 'signup'

interface AuthResponse {
  message?: string
  error?: {
    message?: string
  }
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as AuthResponse
    return payload.error?.message || payload.message || 'Authentication request failed.'
  } catch {
    return 'Authentication request failed.'
  }
}

export const AuthPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isLoading, refreshSession } = useAuthSession()
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const endpoint = useMemo(
    () => (mode === 'signup' ? '/api/auth/sign-up/email' : '/api/auth/sign-in/email'),
    [mode],
  )

  useEffect(() => {
    if (!isLoading && user) {
      void navigate({ to: '/', replace: true })
    }
  }, [isLoading, navigate, user])

  const resetMessages = () => {
    setStatusMessage('')
    setErrorMessage('')
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    resetMessages()
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

    if (mode === 'signup' && name.trim().length < 2) {
      setErrorMessage('Name must contain at least 2 characters.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...(mode === 'signup' ? { name: name.trim() } : {}),
          email: email.trim(),
          password,
        }),
      })

      if (!response.ok) {
        setErrorMessage(await readErrorMessage(response))
        return
      }

      await refreshSession()
      setStatusMessage(mode === 'signup' ? 'Account created successfully.' : 'Logged in successfully.')
      await navigate({ to: '/' })
    } catch {
      setErrorMessage('Unable to reach the authentication service.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onGoogleSignIn = async () => {
    resetMessages()
    setIsGoogleSubmitting(true)

    try {
      const response = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'google',
          disableRedirect: true,
          callbackURL: `${window.location.origin}/`,
          errorCallbackURL: `${window.location.origin}/sign-in?error=oauth`,
        }),
      })

      if (!response.ok) {
        setErrorMessage(await readErrorMessage(response))
        return
      }

      const payload = (await response.json()) as { url?: string }

      if (!payload.url) {
        setErrorMessage('Google sign-in URL was not provided by the authentication service.')
        return
      }

      window.location.assign(payload.url)
    } catch {
      setErrorMessage('Unable to start Google authentication.')
    } finally {
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <article className="content auth-content">
      <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
      <p className="auth-subtitle">Use your email and password with the Better Auth endpoints.</p>

      {!isLoading && user ? (
        <p className="auth-message success" role="status">
          You are already signed in as {user.name || user.email}. Redirecting you to Home...
        </p>
      ) : null}

      <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          className={`auth-mode-button ${mode === 'login' ? 'active' : ''}`}
          aria-selected={mode === 'login'}
          onClick={() => switchMode('login')}
        >
          Log In
        </button>
        <button
          type="button"
          role="tab"
          className={`auth-mode-button ${mode === 'signup' ? 'active' : ''}`}
          aria-selected={mode === 'signup'}
          onClick={() => switchMode('signup')}
        >
          Sign Up
        </button>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === 'signup' ? (
          <label className="auth-field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              autoComplete="name"
            />
          </label>
        ) : null}

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </label>

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : mode === 'signup' ? 'Create Account' : 'Log In'}
        </button>
      </form>

      <div className="auth-divider" aria-hidden="true">
        <span>or continue with</span>
      </div>

      <button className="auth-social" type="button" onClick={onGoogleSignIn} disabled={isGoogleSubmitting}>
        {isGoogleSubmitting ? 'Redirecting to Google...' : 'Continue with Google'}
      </button>

      {statusMessage ? (
        <p className="auth-message success" role="status">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="auth-message error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </article>
  )
}
