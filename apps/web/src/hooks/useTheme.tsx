import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
}

const normalizeTheme = (value: string | null): Theme => {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }

  return 'system'
}

const resolveTheme = (currentTheme: Theme): 'light' | 'dark' => {
  if (currentTheme === 'dark' || currentTheme === 'light') {
    return currentTheme
  }

  if (!window.matchMedia) {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => normalizeTheme(localStorage.getItem('theme')))
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(normalizeTheme(localStorage.getItem('theme'))),
  )

  useEffect(() => {
    const updateResolvedTheme = () => setResolvedTheme(resolveTheme(theme))

    updateResolvedTheme()

    if (!window.matchMedia) {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', updateResolvedTheme)
    return () => mediaQuery.removeEventListener('change', updateResolvedTheme)
  }, [theme])

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme])

  const value: ThemeContextType = {
    theme,
    setTheme,
    resolvedTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
