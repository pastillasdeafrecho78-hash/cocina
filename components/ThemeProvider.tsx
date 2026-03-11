'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  getSystemTheme,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme'

interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  mounted: boolean
  setTheme: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialThemePreference(): ThemePreference {
  if (typeof document !== 'undefined' && isThemePreference(document.documentElement.dataset.themePreference ?? null)) {
    return document.documentElement.dataset.themePreference as ThemePreference
  }

  if (typeof window !== 'undefined') {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemePreference(storedTheme)) return storedTheme
  }

  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [theme, setThemeState] = useState<ThemePreference>(getInitialThemePreference)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
      ? 'dark'
      : 'light'
  )

  useEffect(() => {
    const media = window.matchMedia(THEME_MEDIA_QUERY)
    const syncSystemTheme = () => {
      setSystemTheme(media.matches ? 'dark' : 'light')
    }

    syncSystemTheme()
    setMounted(true)

    media.addEventListener('change', syncSystemTheme)
    return () => media.removeEventListener('change', syncSystemTheme)
  }, [])

  useEffect(() => {
    applyThemeToDocument(theme, systemTheme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme, systemTheme])

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: resolveTheme(theme, systemTheme),
      mounted,
      setTheme,
    }),
    [mounted, setTheme, systemTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider')
  }

  return context
}
