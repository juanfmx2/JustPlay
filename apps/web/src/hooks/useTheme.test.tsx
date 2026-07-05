import { render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from './useTheme'

const ThemeProbe = () => {
  const { resolvedTheme } = useTheme()
  return <span>{resolvedTheme}</span>
}

describe('ThemeProvider', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('uses persisted dark theme immediately', () => {
    localStorage.setItem('theme', 'dark')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByText('dark')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('resolves system theme from media query preference', () => {
    localStorage.setItem('theme', 'system')

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }))

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByText('dark')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})
