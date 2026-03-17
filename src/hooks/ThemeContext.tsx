import { createContext, useContext } from 'react'
import { Moon, Sun, PcDisplay} from 'react-bootstrap-icons'

export enum ThemeEnum {
  LIGHT = "light",
  DARK = "dark",
  AUTO = "auto"
}

export enum ResolvedThemeEnum {
  LIGHT = ThemeEnum.LIGHT,
  DARK = ThemeEnum.DARK
}

export function getThemeLabelComponent(status: ThemeEnum) {
  let component = <></>
  switch (status) {
    case ThemeEnum.LIGHT:
      component = <><Sun/> Light Mode</>;
      break;
    case ThemeEnum.DARK:
      component = <><Moon/> Dark Mode</>;
      break;
    case ThemeEnum.AUTO:
      component = <><PcDisplay/> System Mode</> ;
      break;
  }
  return component
}

export type Theme = ThemeEnum

export type ResolvedTheme = ResolvedThemeEnum

type ThemeContextValue = {
  theme: Theme,
  resolvedTheme: ResolvedTheme,
  setTheme: (theme: Theme) => void,
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({} as ThemeContextValue)

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return value;
}