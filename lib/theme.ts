export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'cocina-theme'
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'

  return window.matchMedia(THEME_MEDIA_QUERY).matches ? 'dark' : 'light'
}

export function applyThemeToDocument(
  preference: ThemePreference,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  if (typeof document === 'undefined') return resolveTheme(preference, systemTheme)

  const resolvedTheme = resolveTheme(preference, systemTheme)
  const root = document.documentElement

  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.dataset.theme = resolvedTheme
  root.dataset.themePreference = preference
  root.style.colorScheme = resolvedTheme

  return resolvedTheme
}

export const themeInitScript = `(() => {
  try {
    const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
    const mediaQuery = ${JSON.stringify(THEME_MEDIA_QUERY)};
    const stored = window.localStorage.getItem(storageKey);
    const preference = stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
    const systemTheme = window.matchMedia(mediaQuery).matches ? 'dark' : 'light';
    const resolvedTheme = preference === 'system' ? systemTheme : preference;
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolvedTheme;
  } catch (error) {
    console.error('No se pudo inicializar el tema', error);
  }
})();`
