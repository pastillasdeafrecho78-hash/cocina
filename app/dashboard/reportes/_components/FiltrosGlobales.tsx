'use client'

import { METODO_PAGO_LABELS, TIPO_PEDIDO_LABELS } from '@/lib/reportes/catalog'
import { ReportFilters } from '@/lib/reportes/types'

interface FiltrosGlobalesProps {
  filters: ReportFilters
  loading: boolean
  onChange: (patch: Partial<ReportFilters>) => void
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-transparent bg-gradient-to-r from-orange-500 via-red-500 to-red-700 text-white shadow-sm'
          : 'border-stone-300 bg-white/80 text-stone-700 hover:border-amber-300 hover:bg-amber-50 dark:bg-stone-900/70 dark:text-stone-200 dark:hover:bg-stone-800'
      }`}
    >
      {label}
    </button>
  )
}

export default function FiltrosGlobales({ filters, loading, onChange }: FiltrosGlobalesProps) {
  const toggleArrayValue = (field: 'tipoPedido' | 'metodoPago', value: string) => {
    const current = filters[field]
    onChange({
      [field]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    })
  }

  return (
    <section className="app-card p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Filtros globales</h2>
          <p className="text-sm text-stone-600">
            Todo el dashboard responde a este rango y a los segmentos seleccionados.
          </p>
        </div>
        {loading && <span className="text-sm text-amber-700 dark:text-amber-300">Actualizando widgets...</span>}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Fecha inicio</span>
            <input
              type="date"
              value={filters.fechaInicio}
              onChange={(event) => onChange({ fechaInicio: event.target.value })}
              className="app-input app-field"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Fecha fin</span>
            <input
              type="date"
              value={filters.fechaFin}
              onChange={(event) => onChange({ fechaFin: event.target.value })}
              className="app-input app-field"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">Tipo de pedido</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TIPO_PEDIDO_LABELS).map(([value, label]) => (
                <ToggleChip
                  key={value}
                  active={filters.tipoPedido.includes(value)}
                  label={label}
                  onClick={() => toggleArrayValue('tipoPedido', value)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">Método de pago</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(METODO_PAGO_LABELS).map(([value, label]) => (
                <ToggleChip
                  key={value}
                  active={filters.metodoPago.includes(value)}
                  label={label}
                  onClick={() => toggleArrayValue('metodoPago', value)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
