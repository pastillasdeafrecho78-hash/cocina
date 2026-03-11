export function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export function formatMetricValue(metric: string, value: number) {
  if (['ventas', 'ticketPromedio', 'propina', 'descuento'].includes(metric)) {
    return formatCurrency(value)
  }

  return formatNumber(value)
}
