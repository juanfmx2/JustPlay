import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ThemeContext, type Theme, type ResolvedTheme, AUTO_THEME_KEY} from './ThemeContext'
import { ScriptOnce } from '@tanstack/react-router'

type ThemeProviderProps = {
  children: ReactNode
}

const STORAGE_KEY = 'theme'
const DATA_BS_ATTRIBUTE = 'data-bs-theme'

const themeScript = `(function() {
  try {
    const theme = localStorage.getItem('${STORAGE_KEY}') || '${AUTO_THEME_KEY}';
    const resolved = theme === '${AUTO_THEME_KEY}'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    console.log('Initial theme:', theme, 'Resolved theme:', resolved);
    document.documentElement.setAttribute('${DATA_BS_ATTRIBUTE}', resolved);
  } catch (e) {}
})();`


function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === AUTO_THEME_KEY) {
    return getSystemTheme()
  }

  return theme
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(AUTO_THEME_KEY)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initialTheme: Theme = saved ?? AUTO_THEME_KEY

    setThemeState(initialTheme)
    setResolvedTheme(resolveTheme(initialTheme))
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      setResolvedTheme((current) => {
        if (theme !== AUTO_THEME_KEY) return current
        return media.matches ? 'dark' : 'light'
      })
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [theme])

  useEffect(() => {
    const html = document.documentElement
    
    html.setAttribute('data-bs-theme', resolvedTheme)
  }, [resolvedTheme])

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
    localStorage.setItem(STORAGE_KEY, nextTheme)
    setResolvedTheme(resolveTheme(nextTheme))
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((theme === 'dark') ? AUTO_THEME_KEY : (theme === AUTO_THEME_KEY ? 'light': 'dark'))
  }, [theme, setTheme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>
    <ScriptOnce>{themeScript}</ScriptOnce>
    {children}
  </ThemeContext.Provider>
}