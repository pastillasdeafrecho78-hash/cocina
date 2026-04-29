export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function totalReembolsado(reembolsos: Array<{ monto: number }>) {
  return roundMoney(reembolsos.reduce((sum, reembolso) => sum + (reembolso.monto || 0), 0))
}

export function montoDisponibleParaReembolso(input: {
  pagoMonto: number
  reembolsos: Array<{ monto: number }>
}) {
  return roundMoney(input.pagoMonto - totalReembolsado(input.reembolsos))
}

export function validarMontoReembolso(input: {
  pagoMonto: number
  reembolsos: Array<{ monto: number }>
  montoSolicitado: number
}) {
  if (!Number.isFinite(input.montoSolicitado) || input.montoSolicitado <= 0) {
    return { ok: false as const, error: 'El monto de reembolso debe ser mayor a 0' }
  }
  const disponible = montoDisponibleParaReembolso(input)
  if (input.montoSolicitado > disponible + 0.01) {
    return {
      ok: false as const,
      error: `El reembolso excede el monto disponible ($${disponible.toFixed(2)})`,
    }
  }
  return { ok: true as const, disponible }
}
