import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ThemeContext, ThemeEnum, ResolvedThemeEnum, type Theme, type ResolvedTheme } from './ThemeContext'
import { ScriptOnce } from '@tanstack/react-router'

type ThemeProviderProps = {
  children: ReactNode
}

const STORAGE_KEY = 'theme'
const DATA_BS_ATTRIBUTE = 'data-bs-theme'

const themeScript = `(function() {
  try {
    const theme = localStorage.getItem('${STORAGE_KEY}') || '${ThemeEnum.AUTO}';
    const resolved = theme === '${ThemeEnum.AUTO}'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? '${ThemeEnum.DARK}' : '${ThemeEnum.LIGHT}')
      : theme;
    console.log('Initial theme:', theme, 'Resolved theme:', resolved);
    document.documentElement.setAttribute('${DATA_BS_ATTRIBUTE}', resolved);
  } catch (e) {}
})();`


function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? ResolvedThemeEnum.DARK
    : ResolvedThemeEnum.LIGHT
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === ThemeEnum.AUTO) {
    return getSystemTheme()
  }
  return theme as unknown as ResolvedTheme
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(ThemeEnum.AUTO)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(ResolvedThemeEnum.LIGHT)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initialTheme: Theme = saved ?? ThemeEnum.AUTO

    setThemeState(initialTheme)
    setResolvedTheme(resolveTheme(initialTheme))
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      setResolvedTheme((current) => {
        if (theme !== ThemeEnum.AUTO) return current
        return media.matches ? ResolvedThemeEnum.DARK : ResolvedThemeEnum.LIGHT
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
    setTheme((theme === ThemeEnum.DARK) ? ThemeEnum.AUTO : (theme === ThemeEnum.AUTO ? ThemeEnum.LIGHT : ThemeEnum.DARK))
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