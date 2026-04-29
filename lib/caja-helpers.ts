import { prisma } from '@/lib/prisma'

const METODOS_EFECTIVO = ['efectivo', 'efectivo_pago']
const METODOS_TARJETA = ['tarjeta_credito', 'tarjeta_debito', 'stripe', 'tarjeta_clip']
const prismaCaja = prisma as any

export interface ReporteCaja {
  fechaInicio: Date
  fechaFin: Date
  totalVentas: number
  totalReembolsos: number
  totalNeto: number
  totalEfectivo: number
  totalTarjeta: number
  totalOtros: number
  numComandas: number
  comandas: Array<{
    id: string
    numeroComanda: string
    total: number
    mesa?: number | null
    fechaCreacion: Date
  }>
}

export interface ComandaPendienteCorteZ {
  id: string
  numeroComanda: string
  estado: string
  mesa: number | null
  fechaCreacion: Date
}

export async function calcularReportePeriodo(
  fechaInicio: Date,
  fechaFin: Date,
  restauranteId: string
): Promise<ReporteCaja> {
  const comandas = await prismaCaja.comanda.findMany({
    where: {
      restauranteId,
      estado: 'PAGADO',
      OR: [
        { fechaCompletado: { gte: fechaInicio, lte: fechaFin } },
        {
          fechaCompletado: null,
          fechaCreacion: { gte: fechaInicio, lte: fechaFin },
        },
      ],
    },
    include: {
      pagos: {
        where: { estado: 'COMPLETADO' },
        include: { reembolsos: true },
      },
      mesa: true,
    },
  })

  const totalVentas = comandas.reduce((sum: number, c: any) => {
    const total = c.total || 0
    const propina = ((c.propina || 0) / 100) * total
    const descuento = c.descuento || 0
    return sum + total + propina - descuento
  }, 0)

  let totalEfectivo = 0
  let totalTarjeta = 0
  let totalOtros = 0
  let totalReembolsos = 0

  for (const comanda of comandas) {
    for (const pago of comanda.pagos) {
      const monto = pago.monto || 0
      const reembolsado = pago.reembolsos.reduce(
        (sum: number, reembolso: { monto: number }) => sum + (reembolso.monto || 0),
        0
      )
      const montoNeto = Math.max(0, monto - reembolsado)
      totalReembolsos += reembolsado
      const metodo = (pago.metodoPago || '').toLowerCase()
      if (METODOS_EFECTIVO.some((m) => metodo.includes(m))) {
        totalEfectivo += montoNeto
      } else if (METODOS_TARJETA.some((m) => metodo.includes(m))) {
        totalTarjeta += montoNeto
      } else {
        totalOtros += montoNeto
      }
    }
  }
  const totalNeto = Math.max(0, totalVentas - totalReembolsos)

  return {
    fechaInicio,
    fechaFin,
    totalVentas,
    totalReembolsos,
    totalNeto,
    totalEfectivo,
    totalTarjeta,
    totalOtros,
    numComandas: comandas.length,
    comandas: comandas.map((c: any) => ({
      id: c.id,
      numeroComanda: c.numeroComanda,
      total: c.total,
      mesa: c.mesa?.numero,
      fechaCreacion: c.fechaCreacion,
    })),
  }
}

export async function obtenerInicioPeriodoActual(
  restauranteId: string
): Promise<Date> {
  const turnoAbierto = await prisma.turnoCaja.findFirst({
    where: { restauranteId, fechaCierre: null },
    orderBy: { fechaApertura: 'desc' },
  })
  if (turnoAbierto) return turnoAbierto.fechaApertura

  const ultimoCorteZ = await prisma.corteZ.findFirst({
    where: { restauranteId },
    orderBy: { fechaHora: 'desc' },
  })
  if (ultimoCorteZ) return ultimoCorteZ.fechaHora

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return hoy
}

export async function obtenerComandasPendientesParaCorteZ(
  restauranteId: string
): Promise<ComandaPendienteCorteZ[]> {
  const pendientes = await prisma.comanda.findMany({
    where: {
      restauranteId,
      estado: {
        notIn: ['PAGADO', 'CANCELADO'],
      },
    },
    include: {
      mesa: {
        select: { numero: true },
      },
    },
    orderBy: { fechaCreacion: 'asc' },
  })

  return pendientes.map((c) => ({
    id: c.id,
    numeroComanda: c.numeroComanda,
    estado: c.estado,
    mesa: c.mesa?.numero ?? null,
    fechaCreacion: c.fechaCreacion,
  }))
}
