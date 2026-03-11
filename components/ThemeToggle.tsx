'use client'

import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline'
import { useTheme } from '@/components/ThemeProvider'
import type { ThemePreference } from '@/lib/theme'

const options: Array<{
  value: ThemePreference
  label: string
  shortLabel: string
  Icon: typeof SunIcon
}> = [
  { value: 'light', label: 'Claro', shortLabel: 'Claro', Icon: SunIcon },
  { value: 'dark', label: 'Oscuro', shortLabel: 'Oscuro', Icon: MoonIcon },
  { value: 'system', label: 'Sistema', shortLabel: 'Sistema', Icon: ComputerDesktopIcon },
]

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, resolvedTheme, mounted, setTheme } = useTheme()

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--surface)/0.88)] p-1 text-sm shadow-sm backdrop-blur ${className}`}
      aria-label="Selector de tema"
      role="group"
    >
      {options.map(({ value, label, shortLabel, Icon }) => {
        const active = theme === value
        const iconClassName =
          mounted && theme === 'system'
            ? resolvedTheme === 'dark'
              ? 'text-amber-300'
              : 'text-amber-600'
            : ''

        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition sm:text-sm ${
              active
                ? 'bg-[rgb(var(--foreground))] text-[rgb(var(--background))] shadow-sm'
                : 'text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-muted)/0.96)] hover:text-[rgb(var(--foreground))]'
            }`}
            aria-pressed={active}
            title={`Cambiar tema a ${label.toLowerCase()}`}
          >
            <Icon className={`h-4 w-4 ${active && value === 'system' ? iconClassName : ''}`} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        )
      })}
    </div>
  )
}
