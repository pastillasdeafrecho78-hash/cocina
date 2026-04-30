'use client'

import type { MesasDashboardView } from './types'

interface MesasViewToggleProps {
  view: MesasDashboardView
  onChange: (view: MesasDashboardView) => void
}

const options: Array<{ value: MesasDashboardView; label: string; description: string }> = [
  { value: 'lista', label: 'Lista', description: 'Tarjetas rápidas' },
  { value: 'plano', label: 'Plano', description: 'Vista espacial' },
]

export default function MesasViewToggle({ view, onChange }: MesasViewToggleProps) {
  return (
    <div className="inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      {options.map((option) => {
        const active = option.value === view
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-4 py-2 text-left transition ${
              active
                ? 'bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-950'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50'
            }`}
            aria-pressed={active}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className={`block text-xs ${active ? 'text-stone-200 dark:text-stone-700' : 'text-stone-500 dark:text-stone-400'}`}>
              {option.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
