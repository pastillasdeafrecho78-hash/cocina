'use client'

import { DashboardVistaData } from '@/lib/reportes/types'

interface GuardadoDeVistasProps {
  activeViewId: string | null
  isDefaultView: boolean
  onChangeView: (viewId: string) => void
  onDelete: () => void
  onSaveAsNew: () => void
  onSaveCurrent: () => void
  saving: boolean
  hasUnsavedChanges: boolean
  setIsDefaultView: (value: boolean) => void
  setViewDescription: (value: string) => void
  setViewName: (value: string) => void
  viewDescription: string
  viewName: string
  views: DashboardVistaData[]
}

export default function GuardadoDeVistas({
  activeViewId,
  isDefaultView,
  onChangeView,
  onDelete,
  onSaveAsNew,
  onSaveCurrent,
  saving,
  hasUnsavedChanges,
  setIsDefaultView,
  setViewDescription,
  setViewName,
  viewDescription,
  viewName,
  views,
}: GuardadoDeVistasProps) {
  return (
    <section className="app-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Vistas guardadas</h2>
          <p className="text-sm text-stone-600">
            Guarda dashboards por turno, caja, ventas o productos.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          {views.length} vistas
        </span>
      </div>
      {hasUnsavedChanges && (
        <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">
          Tienes cambios sin guardar en esta vista.
        </p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Vista activa</span>
          <select
            value={activeViewId || ''}
            onChange={(event) => onChangeView(event.target.value)}
            className="app-input app-field"
          >
            <option value="">Vista temporal</option>
            {views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.nombre}
                {view.esDefault ? ' · Predeterminada' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-end gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 dark:bg-stone-900/50">
          <input
            type="checkbox"
            checked={isDefaultView}
            onChange={(event) => setIsDefaultView(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
          />
          <span className="text-sm text-stone-700">Usar como vista predeterminada</span>
        </label>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Nombre</span>
          <input
            type="text"
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            placeholder="Ej. Ventas nocturnas"
            className="app-input app-field"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Descripción</span>
          <textarea
            value={viewDescription}
            onChange={(event) => setViewDescription(event.target.value)}
            placeholder="Qué intenta responder este tablero"
            rows={3}
            className="app-input app-field px-4 py-3"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSaveAsNew}
          disabled={saving}
          className="app-btn-primary"
        >
          Guardar como nueva
        </button>
        <button
          type="button"
          onClick={onSaveCurrent}
          disabled={saving || !activeViewId}
          className="app-btn-secondary"
        >
          Actualizar vista
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving || !activeViewId}
          className="app-btn-danger"
        >
          Eliminar vista
        </button>
      </div>
    </section>
  )
}
