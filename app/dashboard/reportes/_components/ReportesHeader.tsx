'use client'

import BackButton from '@/components/BackButton'

export default function ReportesHeader() {
  return (
    <div className="app-brand-panel p-5 sm:p-6">
      <BackButton className="mb-4" />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="app-kicker">Inteligencia operativa</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-900 sm:text-4xl">
            Reportes con estilo ServimOS
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-stone-600 sm:text-base">
            Construye tableros visuales con la misma identidad del resto del sistema:
            filtros claros, widgets editables y vistas reutilizables para caja, ventas,
            producto y operación.
          </p>
        </div>

        <div className="app-note max-w-sm px-4 py-3 text-sm">
          Dashboard configurable con vistas personales, filtros globales y lectura clara en
          modo claro u oscuro.
        </div>
      </div>
    </div>
  )
}
