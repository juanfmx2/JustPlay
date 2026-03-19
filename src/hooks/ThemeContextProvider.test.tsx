import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from './ThemeContextProvider'
import { ThemeEnum, useTheme } from './ThemeContext'

jest.mock('@tanstack/react-router', () => ({
  ScriptOnce: ({ children }: { children?: ReactNode }) => (
    <>{children ? null : null}</>
  ),
}))

type MatchMediaController = {
  setMatches: (nextValue: boolean) => void
}

function mockMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      get matches() {
        return matches
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      },
      dispatchEvent: () => true,
    })),
  })

  return {
    setMatches(nextValue: boolean) {
      matches = nextValue
      const event = { matches: nextValue } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}

function ThemeTestHarness() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()

  return (
    <>
      <div data-testid="theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button type="button" onClick={() => setTheme(ThemeEnum.LIGHT)}>
        set-light
      </button>
      <button type="button" onClick={() => setTheme(ThemeEnum.DARK)}>
        set-dark
      </button>
      <button type="button" onClick={() => setTheme(ThemeEnum.AUTO)}>
        set-auto
      </button>
      <button type="button" onClick={toggleTheme}>
        toggle-theme
      </button>
    </>
  )
}

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <ThemeTestHarness />
    </ThemeProvider>,
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-bs-theme')
    jest.clearAllMocks()
  })

  it('applies light theme to the DOM when set to light', async () => {
    mockMatchMedia(true)
    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent(ThemeEnum.DARK)
      expect(document.documentElement).toHaveAttribute('data-bs-theme', ThemeEnum.DARK)
    })

    fireEvent.click(screen.getByRole('button', { name: 'set-light' }))

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent(ThemeEnum.LIGHT)
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent(ThemeEnum.LIGHT)
      expect(document.documentElement).toHaveAttribute('data-bs-theme', ThemeEnum.LIGHT)
      expect(localStorage.getItem('theme')).toBe(ThemeEnum.LIGHT)
    })
  })

  it('applies dark theme to the DOM when set to dark', async () => {
    mockMatchMedia(false)
    renderWithProvider()

    fireEvent.click(screen.getByRole('button', { name: 'set-dark' }))

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent(ThemeEnum.DARK)
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent(ThemeEnum.DARK)
      expect(document.documentElement).toHaveAttribute('data-bs-theme', ThemeEnum.DARK)
      expect(localStorage.getItem('theme')).toBe(ThemeEnum.DARK)
    })
  })

  it('follows system theme and updates DOM when system preference changes', async () => {
    const media = mockMatchMedia(false)
    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent(ThemeEnum.AUTO)
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent(ThemeEnum.LIGHT)
      expect(document.documentElement).toHaveAttribute('data-bs-theme', ThemeEnum.LIGHT)
    })

    fireEvent.click(screen.getByRole('button', { name: 'set-auto' }))

    await waitFor(() => {
      expect(localStorage.getItem('theme')).toBe(ThemeEnum.AUTO)
    })

    act(() => {
      media.setMatches(true)
    })

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent(ThemeEnum.DARK)
      expect(document.documentElement).toHaveAttribute('data-bs-theme', ThemeEnum.DARK)
    })

    act(() => {
      media.setMatches(false)
    })

    await waitFor(() => {
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent(ThemeEnum.LIGHT)
      expect(document.documentElement).toHaveAttribute('data-bs-theme', ThemeEnum.LIGHT)
    })
  })

  it('loads saved theme from localStorage on mount and updates DOM', async () => {
    mockMatchMedia(false)
    localStorage.setItem('theme', ThemeEnum.DARK)

    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent(ThemeEnum.DARK)
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent(ThemeEnum.DARK)
      expect(document.documentElement).toHaveAttribute('data-bs-theme', ThemeEnum.DARK)
    })
  })

  it('loads saved theme from localStorage on mount and defaults to AUTO if value is invalid', async () => {
    mockMatchMedia(false)
    localStorage.setItem('theme', 'invalid-value')

    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent(ThemeEnum.AUTO)
      expect(screen.getByTestId('resolved-theme')).toHaveTextContent(ThemeEnum.LIGHT)
      expect(document.documentElement).toHaveAttribute('data-bs-theme', ThemeEnum.LIGHT)
    })
  })
})
