import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthPage } from './AuthPage'

const navigateMock = jest.fn()

jest.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

describe('AuthPage', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('submits login payload to Better Auth sign-in endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AuthPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/sign-in/email',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      )
    })
  })

  it('submits signup payload to Better Auth sign-up endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AuthPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Sign Up' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/sign-up/email',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      )
    })
  })

  it('requests Better Auth social sign-in endpoint for Google', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Google provider is not configured.' } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AuthPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/sign-in/social',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: expect.stringContaining('"provider":"google"'),
        }),
      )
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Google provider is not configured.')
  })
})
