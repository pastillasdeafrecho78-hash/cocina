export type FormaMesaLayout = 'RECTANGULAR' | 'CIRCULAR'

export function normalizeMesaLayout(input: {
  forma?: FormaMesaLayout | null
  ancho?: number | null
  alto?: number | null
}) {
  const forma = input.forma ?? 'RECTANGULAR'
  const ancho = clampDimension(input.ancho ?? 1)
  const alto = forma === 'CIRCULAR' ? ancho : clampDimension(input.alto ?? 1)
  return { forma, ancho, alto }
}

export function clampDimension(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(0.75, Math.min(6, Math.round(value * 4) / 4))
}

export function getMesaPixelSize(input: {
  ancho?: number | null
  alto?: number | null
  cellSize: number
}) {
  return {
    width: clampDimension(input.ancho ?? 1) * input.cellSize,
    height: clampDimension(input.alto ?? 1) * input.cellSize,
  }
}
