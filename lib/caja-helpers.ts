import { prisma } from '@/lib/prisma'

const METODOS_EFECTIVO = ['efectivo', 'efectivo_pago']
const METODOS_TARJETA = ['tarjeta_credito', 'tarjeta_debito', 'stripe']

export interface ReporteCaja {
  fechaInicio: Date
  fechaFin: Date
  totalVentas: number
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

export async function calcularReportePeriodo(
  fechaInicio: Date,
  fechaFin: Date
): Promise<ReporteCaja> {
  // Comandas PAGADAS: si tienen fechaCompletado, filtrar por ella; si no, por fechaCreacion
  const comandas = await prisma.comanda.findMany({
    where: {
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
      pagos: { where: { estado: 'COMPLETADO' } },
      mesa: true,
    },
  })

  const totalVentas = comandas.reduce((sum, c) => {
    const total = c.total || 0
    const propina = ((c.propina || 0) / 100) * total
    const descuento = c.descuento || 0
    return sum + total + propina - descuento
  }, 0)

  let totalEfectivo = 0
  let totalTarjeta = 0
  let totalOtros = 0

  for (const comanda of comandas) {
    for (const pago of comanda.pagos) {
      const monto = pago.monto || 0
      const metodo = (pago.metodoPago || '').toLowerCase()
      if (METODOS_EFECTIVO.some((m) => metodo.includes(m))) {
        totalEfectivo += monto
      } else if (METODOS_TARJETA.some((m) => metodo.includes(m))) {
        totalTarjeta += monto
      } else {
        totalOtros += monto
      }
    }
  }

  return {
    fechaInicio,
    fechaFin,
    totalVentas,
    totalEfectivo,
    totalTarjeta,
    totalOtros,
    numComandas: comandas.length,
    comandas: comandas.map((c) => ({
      id: c.id,
      numeroComanda: c.numeroComanda,
      total: c.total,
      mesa: c.mesa?.numero,
      fechaCreacion: c.fechaCreacion,
    })),
  }
}

export async function obtenerInicioPeriodoActual(): Promise<Date> {
  const ultimoCorteZ = await prisma.corteZ.findFirst({
    orderBy: { fechaHora: 'desc' },
  })
  if (ultimoCorteZ) return ultimoCorteZ.fechaHora
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return hoy
}
