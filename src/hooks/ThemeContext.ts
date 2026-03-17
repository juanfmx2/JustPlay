import { createContext, useContext } from 'react'

export const AUTO_THEME_KEY = 'system'

export type Theme = 'light' | 'dark' | typeof AUTO_THEME_KEY

export type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({} as ThemeContextValue)

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)

  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return value
}