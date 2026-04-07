'use client'

import DashboardCanvas from '@/app/dashboard/reportes/_components/DashboardCanvas'
import FiltrosGlobales from '@/app/dashboard/reportes/_components/FiltrosGlobales'
import GuardadoDeVistas from '@/app/dashboard/reportes/_components/GuardadoDeVistas'
import ReportesHeader from '@/app/dashboard/reportes/_components/ReportesHeader'
import WidgetConfigPanel from '@/app/dashboard/reportes/_components/WidgetConfigPanel'
import { useReportesDashboard } from '@/app/dashboard/reportes/useReportesDashboard'

export default function ReportesPage() {
  const {
    activeViewId,
    addWidget,
    deleteCurrentView,
    duplicateWidget,
    filterOptions,
    filters,
    hasUnsavedChanges,
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
  } = useReportesDashboard()

  return (
    <div className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <ReportesHeader />

        <GuardadoDeVistas
          activeViewId={activeViewId}
          isDefaultView={isDefaultView}
          onChangeView={selectView}
          onDelete={deleteCurrentView}
          onSaveAsNew={() => saveCurrentView('create')}
          onSaveCurrent={() => saveCurrentView('update')}
          saving={savingView}
          hasUnsavedChanges={hasUnsavedChanges}
          setIsDefaultView={setIsDefaultView}
          setViewDescription={setViewDescription}
          setViewName={setViewName}
          viewDescription={viewDescription}
          viewName={viewName}
          views={views}
        />

        <FiltrosGlobales filters={filters} loading={loading} onChange={updateFilters} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DashboardCanvas
            loading={loading}
            onDeleteWidget={removeWidget}
            onDuplicateWidget={duplicateWidget}
            onMoveWidget={moveWidget}
            onSelectWidget={setSelectedWidgetId}
            results={results}
            selectedWidgetId={selectedWidgetId}
            widgets={widgets}
          />

          <WidgetConfigPanel
            filterOptions={filterOptions}
            onAddWidget={addWidget}
            onChange={updateWidget}
            selectedWidget={selectedWidget}
          />
        </div>
      </div>
    </div>
  )
}
