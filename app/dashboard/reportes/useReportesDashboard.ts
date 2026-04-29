'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/auth-fetch'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  REPORT_DIMENSIONS,
  REPORT_PRESETS,
  buildWidgetTitle,
  getDefaultReportFilters,
  getDefaultWidgets,
} from '@/lib/reportes/catalog'
import {
  DashboardVistaData,
  ReportFilters,
  ReportWidgetConfig,
  ReportWidgetFilters,
  ReportWidgetResult,
} from '@/lib/reportes/types'

function parseFiltersFromSearchParams(searchParams: {
  get: (key: string) => string | null
  getAll: (key: string) => string[]
}): Partial<ReportFilters> {
  return {
    fechaInicio: searchParams.get('fechaInicio') || undefined,
    fechaFin: searchParams.get('fechaFin') || undefined,
    tipoPedido: searchParams.getAll('tipoPedido'),
    metodoPago: searchParams.getAll('metodoPago'),
  }
}

function createWidget(): ReportWidgetConfig {
  return {
    id: crypto.randomUUID(),
    title: 'Nuevo widget',
    dimension: 'dia',
    metric: 'ventas',
    chartType: 'bar',
    limit: 8,
    sort: 'desc',
    widgetFilters: {},
  }
}

function normalizeWidgetFilters(filters?: ReportWidgetFilters): ReportWidgetFilters {
  return {
    fechaInicio: filters?.fechaInicio || undefined,
    fechaFin: filters?.fechaFin || undefined,
    estados: Array.isArray(filters?.estados) ? filters.estados.filter(Boolean) : [],
    tipoPedido: Array.isArray(filters?.tipoPedido) ? filters.tipoPedido.filter(Boolean) : [],
    metodoPago: Array.isArray(filters?.metodoPago) ? filters.metodoPago.filter(Boolean) : [],
    creadorIds: Array.isArray(filters?.creadorIds) ? filters.creadorIds.filter(Boolean) : [],
    canceladorIds: Array.isArray(filters?.canceladorIds) ? filters.canceladorIds.filter(Boolean) : [],
    motivosCancelacion: Array.isArray(filters?.motivosCancelacion)
      ? filters.motivosCancelacion.filter(Boolean)
      : [],
  }
}

function normalizeWidgetConfig(widget: ReportWidgetConfig): ReportWidgetConfig {
  const dimension =
    (widget.dimension as unknown as string) === 'usuario' ? 'usuarioCreador' : widget.dimension
  return {
    ...widget,
    dimension: dimension as ReportWidgetConfig['dimension'],
    widgetFilters: normalizeWidgetFilters(widget.widgetFilters),
  }
}

export function useReportesDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [initialFilters] = useState<ReportFilters>(() => {
    const defaults = getDefaultReportFilters()
    const urlFilters = parseFiltersFromSearchParams(searchParams)
    return {
      fechaInicio: urlFilters.fechaInicio || defaults.fechaInicio,
      fechaFin: urlFilters.fechaFin || defaults.fechaFin,
      tipoPedido: urlFilters.tipoPedido || [],
      metodoPago: urlFilters.metodoPago || [],
    }
  })

  const [hasInitialUrlOverrides] = useState(() => {
    return Boolean(
      searchParams.get('fechaInicio') ||
        searchParams.get('fechaFin') ||
        searchParams.getAll('tipoPedido').length > 0 ||
        searchParams.getAll('metodoPago').length > 0
    )
  })

  const [filters, setFilters] = useState<ReportFilters>(initialFilters)
  const [widgets, setWidgets] = useState<ReportWidgetConfig[]>(
    getDefaultWidgets().map(normalizeWidgetConfig)
  )
  const [results, setResults] = useState<Record<string, ReportWidgetResult>>({})
  const [views, setViews] = useState<DashboardVistaData[]>([])
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [viewName, setViewName] = useState('Mi tablero')
  const [viewDescription, setViewDescription] = useState('')
  const [isDefaultView, setIsDefaultView] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingView, setSavingView] = useState(false)
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const [lastSavedSignature, setLastSavedSignature] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<{
    creadores: Array<{ id: string; label: string }>
    canceladores: Array<{ id: string; label: string }>
    motivosCancelacion: string[]
  }>({ creadores: [], canceladores: [], motivosCancelacion: [] })

  const activeView = useMemo(
    () => views.find((view) => view.id === activeViewId) || null,
    [views, activeViewId]
  )

  const selectedWidget = useMemo(
    () => widgets.find((widget) => widget.id === selectedWidgetId) || null,
    [widgets, selectedWidgetId]
  )
  const widgetsQuerySignature = useMemo(
    () =>
      JSON.stringify(
        widgets.map((widget) => ({
          id: widget.id,
          dimension: widget.dimension,
          metric: widget.metric,
          chartType: widget.chartType,
          limit: widget.limit,
          sort: widget.sort,
          widgetFilters: widget.widgetFilters,
        }))
      ),
    [widgets]
  )
  const widgetsForQuery = useMemo(() => widgets, [widgetsQuerySignature])
  const currentConfigSignature = useMemo(
    () =>
      JSON.stringify({
        viewName: viewName.trim(),
        viewDescription: viewDescription.trim(),
        isDefaultView,
        filters,
        widgets,
      }),
    [filters, isDefaultView, viewDescription, viewName, widgets]
  )
  const hasUnsavedChanges =
    lastSavedSignature !== null && currentConfigSignature !== lastSavedSignature

  const syncQueryString = useCallback(
    (nextFilters: ReportFilters) => {
      const params = new URLSearchParams()
      params.set('fechaInicio', nextFilters.fechaInicio)
      params.set('fechaFin', nextFilters.fechaFin)
      nextFilters.tipoPedido.forEach((value) => params.append('tipoPedido', value))
      nextFilters.metodoPago.forEach((value) => params.append('metodoPago', value))
      router.replace(`/dashboard/reportes?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  const fetchViews = useCallback(async () => {
    const response = await apiFetch('/api/reportes/vistas', {
      headers: {},
    })
    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'No se pudieron cargar las vistas')
    }

    return (data.data || []) as DashboardVistaData[]
  }, [])

  const hydrateFromView = useCallback(
    (view: DashboardVistaData | null) => {
      if (!view) {
        const defaultWidgets = getDefaultWidgets().map(normalizeWidgetConfig)
        setFilters(initialFilters)
        setWidgets(defaultWidgets)
        setSelectedWidgetId(defaultWidgets[0]?.id || null)
        setActiveViewId(null)
        setViewName('Mi tablero')
        setViewDescription('')
        setIsDefaultView(false)
        setLastSavedSignature(
          JSON.stringify({
            viewName: 'Mi tablero',
            viewDescription: '',
            isDefaultView: false,
            filters: initialFilters,
            widgets: defaultWidgets,
          })
        )
        return
      }

      const hydratedFilters = hasInitialUrlOverrides ? initialFilters : view.filtros
      const normalizedWidgets = view.widgets.map(normalizeWidgetConfig)
      setActiveViewId(view.id)
      setFilters(hydratedFilters)
      setWidgets(normalizedWidgets)
      setSelectedWidgetId(normalizedWidgets[0]?.id || null)
      setViewName(view.nombre)
      setViewDescription(view.descripcion || '')
      setIsDefaultView(view.esDefault)
      setLastSavedSignature(
        JSON.stringify({
          viewName: view.nombre.trim(),
          viewDescription: (view.descripcion || '').trim(),
          isDefaultView: view.esDefault,
          filters: hydratedFilters,
          widgets: normalizedWidgets,
        })
      )
    },
    [hasInitialUrlOverrides, initialFilters]
  )

  const loadInitialState = useCallback(async () => {
    try {
      setLoading(true)
      const loadedViews = await fetchViews()
      setViews(loadedViews)

      if (loadedViews.length > 0) {
        hydrateFromView(loadedViews.find((view) => view.esDefault) || loadedViews[0])
      } else {
        setFilters(initialFilters)
        const defaultWidgets = getDefaultWidgets().map(normalizeWidgetConfig)
        setWidgets(defaultWidgets)
        setSelectedWidgetId(defaultWidgets[0]?.id || null)
        setLastSavedSignature(
          JSON.stringify({
            viewName: 'Mi tablero',
            viewDescription: '',
            isDefaultView: false,
            filters: initialFilters,
            widgets: defaultWidgets,
          })
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar las vistas'
      toast.error(message)
    } finally {
      setIsBootstrapped(true)
      setLoading(false)
    }
  }, [fetchViews, hydrateFromView, initialFilters])

  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await apiFetch('/api/comandas?estado=CANCELADO,PAGADO&limit=200', {
        headers: {},
      })
      const data = await response.json()
      if (!response.ok || !data.success) return
      const comandas = Array.isArray(data.data) ? data.data : []
      const creadores = new Map<string, string>()
      const canceladores = new Map<string, string>()
      const motivos = new Set<string>()
      for (const comanda of comandas) {
        if (comanda?.creadoPor?.id) {
          creadores.set(
            comanda.creadoPor.id,
            `${comanda.creadoPor.nombre || ''} ${comanda.creadoPor.apellido || ''}`.trim()
          )
        }
        if (comanda?.canceladoPor?.id) {
          canceladores.set(
            comanda.canceladoPor.id,
            `${comanda.canceladoPor.nombre || ''} ${comanda.canceladoPor.apellido || ''}`.trim()
          )
        }
        if (typeof comanda?.motivoCancelacion === 'string' && comanda.motivoCancelacion.trim()) {
          motivos.add(comanda.motivoCancelacion.trim())
        }
      }
      setFilterOptions({
        creadores: Array.from(creadores.entries()).map(([id, label]) => ({ id, label })),
        canceladores: Array.from(canceladores.entries()).map(([id, label]) => ({ id, label })),
        motivosCancelacion: Array.from(motivos.values()).sort((a, b) => a.localeCompare(b)),
      })
    } catch {
      // Opciones auxiliares no críticas.
    }
  }, [])

  const fetchWidgetResults = useCallback(async () => {
    if (!isBootstrapped) return

    try {
      setLoading(true)

      if (widgetsForQuery.length === 0) {
        setResults({})
        return
      }
      const responses = await Promise.all(
        widgetsForQuery.map(async (widget) => {
          const mergedFilters: ReportFilters = {
            ...filters,
            fechaInicio: widget.widgetFilters?.fechaInicio || filters.fechaInicio,
            fechaFin: widget.widgetFilters?.fechaFin || filters.fechaFin,
            tipoPedido:
              (widget.widgetFilters?.tipoPedido || []).length > 0
                ? widget.widgetFilters!.tipoPedido!
                : filters.tipoPedido,
            metodoPago:
              (widget.widgetFilters?.metodoPago || []).length > 0
                ? widget.widgetFilters!.metodoPago!
                : filters.metodoPago,
            estados: widget.widgetFilters?.estados || [],
            creadorIds: widget.widgetFilters?.creadorIds || [],
            canceladorIds: widget.widgetFilters?.canceladorIds || [],
            motivosCancelacion: widget.widgetFilters?.motivosCancelacion || [],
          }
          const response = await apiFetch('/api/reportes/query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filters: mergedFilters, widget }),
          })
          const data = await response.json()

          if (!response.ok || !data.success) {
            throw new Error(data.error || `No se pudo cargar el widget ${widget.title}`)
          }

          return data.data as ReportWidgetResult
        })
      )

      setResults(Object.fromEntries(responses.map((item) => [item.widgetId, item])))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los widgets'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [filters, isBootstrapped, widgetsForQuery])

  useEffect(() => {
    loadInitialState()
  }, [loadInitialState])

  useEffect(() => {
    fetchWidgetResults()
  }, [fetchWidgetResults])

  useEffect(() => {
    if (!isBootstrapped) return
    fetchFilterOptions()
  }, [fetchFilterOptions, isBootstrapped])

  useEffect(() => {
    if (!isBootstrapped) return
    syncQueryString(filters)
  }, [filters, isBootstrapped, syncQueryString])

  useEffect(() => {
    if (widgets.length === 0) {
      setSelectedWidgetId(null)
      return
    }

    if (!widgets.some((widget) => widget.id === selectedWidgetId)) {
      setSelectedWidgetId(widgets[0].id)
    }
  }, [selectedWidgetId, widgets])

  const updateFilters = useCallback((patch: Partial<ReportFilters>) => {
    setFilters((current) => ({
      ...current,
      ...patch,
    }))
  }, [])

  const selectView = useCallback(
    (viewId: string) => {
      const nextView = views.find((view) => view.id === viewId) || null
      hydrateFromView(nextView)
    },
    [hydrateFromView, views]
  )

  const addWidget = useCallback(() => {
    const widget = normalizeWidgetConfig(createWidget())
    widget.title = buildWidgetTitle(widget.dimension, widget.metric)
    setWidgets((current) => [...current, widget])
    setSelectedWidgetId(widget.id)
  }, [])

  const addWidgetFromPreset = useCallback((presetId: string) => {
    const preset = REPORT_PRESETS.find((item) => item.id === presetId)
    if (!preset) return

    const widget = normalizeWidgetConfig({
      ...preset.widget,
      id: crypto.randomUUID(),
      widgetFilters: {},
    })
    setWidgets((current) => [...current, widget])
    setSelectedWidgetId(widget.id)
  }, [])

  const updateWidget = useCallback((widgetId: string, patch: Partial<ReportWidgetConfig>) => {
    setWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== widgetId) return widget

        const nextWidget = normalizeWidgetConfig({ ...widget, ...patch } as ReportWidgetConfig)
        if (patch.dimension) {
          const supportedMetrics =
            REPORT_DIMENSIONS.find((item) => item.value === patch.dimension)?.supportedMetrics || []
          if (!supportedMetrics.includes(nextWidget.metric)) {
            nextWidget.metric = supportedMetrics[0]
          }
        }

        if (patch.dimension || patch.metric || !nextWidget.title.trim()) {
          nextWidget.title = buildWidgetTitle(nextWidget.dimension, nextWidget.metric)
        }

        return nextWidget
      })
    )
  }, [])

  const duplicateWidget = useCallback((widgetId: string) => {
    let cloneId: string | null = null
    setWidgets((current) => {
      const source = current.find((item) => item.id === widgetId)
      if (!source) return current

      const clone = {
        ...normalizeWidgetConfig(source),
        id: crypto.randomUUID(),
        title: `${source.title} copia`,
      }
      cloneId = clone.id

      return [...current, clone]
    })
    if (cloneId) {
      setSelectedWidgetId(cloneId)
    }
  }, [])

  const removeWidget = useCallback((widgetId: string) => {
    setWidgets((current) => current.filter((widget) => widget.id !== widgetId))
    setResults((current) => {
      const next = { ...current }
      delete next[widgetId]
      return next
    })
  }, [])

  const moveWidget = useCallback((widgetId: string, direction: 'up' | 'down') => {
    setWidgets((current) => {
      const index = current.findIndex((widget) => widget.id === widgetId)
      if (index === -1) return current

      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= current.length) return current

      const copy = [...current]
      const [widget] = copy.splice(index, 1)
      copy.splice(nextIndex, 0, widget)
      return copy
    })
  }, [])

  const saveCurrentView = useCallback(
    async (mode: 'create' | 'update') => {
      try {
        setSavingView(true)

        if (!viewName.trim()) {
          toast.error('Ponle nombre a la vista antes de guardar')
          return
        }
        const payload = {
          nombre: viewName.trim(),
          descripcion: viewDescription.trim() || null,
          esDefault: isDefaultView,
          filtros: filters,
          widgets: widgets.map(normalizeWidgetConfig),
        }

        const url =
          mode === 'update' && activeViewId
            ? `/api/reportes/vistas/${activeViewId}`
            : '/api/reportes/vistas'

        const response = await apiFetch(url, {
          method: mode === 'update' && activeViewId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'No se pudo guardar la vista')
        }

        const loadedViews = await fetchViews()
        setViews(loadedViews)
        const savedView =
          loadedViews.find((view) => view.id === data.data.id) ||
          loadedViews.find((view) => view.esDefault) ||
          loadedViews[0] ||
          null

        hydrateFromView(savedView)
        toast.success(mode === 'update' ? 'Vista actualizada' : 'Vista guardada')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo guardar la vista'
        toast.error(message)
      } finally {
        setSavingView(false)
      }
    },
    [
      activeViewId,
      fetchViews,
      filters,
      hydrateFromView,
      isDefaultView,
      viewDescription,
      viewName,
      widgets,
    ]
  )

  const deleteCurrentView = useCallback(async () => {
    if (!activeViewId) {
      toast.error('Selecciona una vista guardada para eliminarla')
      return
    }

    try {
      setSavingView(true)
      const response = await apiFetch(`/api/reportes/vistas/${activeViewId}`, {
        method: 'DELETE',
        headers: {},
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo eliminar la vista')
      }

      const loadedViews = await fetchViews()
      setViews(loadedViews)
      hydrateFromView(loadedViews.find((view) => view.esDefault) || loadedViews[0] || null)
      toast.success('Vista eliminada')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar la vista'
      toast.error(message)
    } finally {
      setSavingView(false)
    }
  }, [activeViewId, fetchViews, hydrateFromView])

  return {
    activeView,
    activeViewId,
    addWidget,
    addWidgetFromPreset,
    deleteCurrentView,
    duplicateWidget,
    filterOptions,
    filters,
    hasUnsavedChanges,
    isBootstrapped,
    isDefaultView,
    loading,
    moveWidget,
    removeWidget,
    results,
    saveCurrentView,
    savingView,
    selectedWidget,
    selectedWidgetId,
    selectView,
    setIsDefaultView,
    setSelectedWidgetId,
    setViewDescription,
    setViewName,
    updateFilters,
    updateWidget,
    viewDescription,
    viewName,
    views,
    widgets,
  }
}
