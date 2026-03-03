/**
 * Presets fiscales para Modo Fácil
 * Cada preset se traduce a la Configuración actual (sin duplicar reglas).
 * Fuente de verdad: ConfiguracionRestaurante + validaciones en validaciones-fiscales.
 */

import { FORMAS_PAGO, USOS_CFDI } from './catalogos-sat'

export type TipoVenta = 'mostrador' | 'domicilio' | 'plataforma'
export type PoliticaPropinaPreset = 'no_facturar' | 'facturar' | 'separar'

export interface PresetEmision {
  id: string
  nombre: string
  descripcion: string
  tipoVenta: TipoVenta
  metodoPago: string       // PUE | PPD
  formaPago: string        // 01, 03, 04, 28, etc.
  usoCFDI: string          // S01, G03, etc.
  propinaFacturar: boolean
  esGlobalDefault: boolean // si no hay datos cliente, usar global
}

export interface OverridesEmision {
  usoCFDI?: string
  formaPago?: string
  metodoPago?: string
  propinaFacturar?: boolean
  esFacturaGlobal?: boolean
}

/** Mapeo forma de pago legible → clave SAT */
export const FORMA_PAGO_POR_METODO: Record<string, string> = {
  efectivo: '01',
  tarjeta_credito: '04',
  tarjeta_debito: '28',
  transferencia: '03',
  oxxo: '01', // OXXO suele reportarse como efectivo
}

/**
 * Presets recomendados para restaurante
 */
export const PRESETS_EMISION: PresetEmision[] = [
  {
    id: 'MOSTRADOR_PUE_EFECTIVO',
    nombre: 'Mostrador · Pago al momento · Efectivo',
    descripcion: 'Venta en mostrador, cobro en efectivo al momento.',
    tipoVenta: 'mostrador',
    metodoPago: 'PUE',
    formaPago: '01',
    usoCFDI: 'S01',
    propinaFacturar: false,
    esGlobalDefault: true,
  },
  {
    id: 'MOSTRADOR_PUE_TARJETA',
    nombre: 'Mostrador · Pago al momento · Tarjeta',
    descripcion: 'Venta en mostrador, pago con tarjeta al momento.',
    tipoVenta: 'mostrador',
    metodoPago: 'PUE',
    formaPago: '04',
    usoCFDI: 'S01',
    propinaFacturar: false,
    esGlobalDefault: true,
  },
  {
    id: 'DOMICILIO_PUE_EFECTIVO',
    nombre: 'Domicilio · Pago al momento · Efectivo',
    descripcion: 'Entrega a domicilio, cobro en efectivo.',
    tipoVenta: 'domicilio',
    metodoPago: 'PUE',
    formaPago: '01',
    usoCFDI: 'S01',
    propinaFacturar: false,
    esGlobalDefault: true,
  },
  {
    id: 'DOMICILIO_PUE_TARJETA',
    nombre: 'Domicilio · Pago al momento · Tarjeta',
    descripcion: 'Entrega a domicilio, pago con tarjeta.',
    tipoVenta: 'domicilio',
    metodoPago: 'PUE',
    formaPago: '04',
    usoCFDI: 'S01',
    propinaFacturar: false,
    esGlobalDefault: true,
  },
  {
    id: 'PLATAFORMA_PUE_TRANSFERENCIA',
    nombre: 'Plataforma / App · Pago al momento · Transferencia',
    descripcion: 'Pedido por app/plataforma, pago en línea.',
    tipoVenta: 'plataforma',
    metodoPago: 'PUE',
    formaPago: '03',
    usoCFDI: 'S01',
    propinaFacturar: false,
    esGlobalDefault: true,
  },
  {
    id: 'MOSTRADOR_PPD_EFECTIVO',
    nombre: 'Mostrador · Pago después · Efectivo',
    descripcion: 'Consumo en mostrador, se factura después; cobro en efectivo.',
    tipoVenta: 'mostrador',
    metodoPago: 'PPD',
    formaPago: '01',
    usoCFDI: 'S01',
    propinaFacturar: false,
    esGlobalDefault: true,
  },
  {
    id: 'MOSTRADOR_PUE_EFECTIVO_PROPINA',
    nombre: 'Mostrador · Efectivo · Con propina facturada',
    descripcion: 'Mostrador, efectivo, propina incluida en CFDI.',
    tipoVenta: 'mostrador',
    metodoPago: 'PUE',
    formaPago: '01',
    usoCFDI: 'S01',
    propinaFacturar: true,
    esGlobalDefault: true,
  },
  // ===== PRESETS DE EJEMPLO =====
  // 1. AVANZADO: Preset para empresas con crédito y uso CFDI específico
  {
    id: 'AVANZADO_EMPRESA_CREDITO',
    nombre: '🏢 Empresa · Crédito · Uso G03',
    descripcion: 'Facturación a empresa con crédito (PPD), uso CFDI G03 (Gastos en general), propina no facturable. Para clientes corporativos con cuenta corriente.',
    tipoVenta: 'mostrador',
    metodoPago: 'PPD',
    formaPago: '03', // Transferencia electrónica
    usoCFDI: 'G03', // Gastos en general
    propinaFacturar: false,
    esGlobalDefault: false, // Siempre nominativa para empresas
  },
  // 2. FÁCIL 1: Preset súper simple para venta rápida
  {
    id: 'FACIL_RAPIDO_EFECTIVO',
    nombre: '⚡ Rápido · Efectivo',
    descripcion: 'Venta rápida en efectivo, factura global. Sin propina. Para servicio rápido.',
    tipoVenta: 'mostrador',
    metodoPago: 'PUE',
    formaPago: '01',
    usoCFDI: 'S01',
    propinaFacturar: false,
    esGlobalDefault: true,
  },
  // 3. FÁCIL 2: Preset simple para domicilio
  {
    id: 'FACIL_DOMICILIO_TARJETA',
    nombre: '🚚 Domicilio · Tarjeta',
    descripcion: 'Entrega a domicilio, pago con tarjeta. Factura global. Simple y rápido.',
    tipoVenta: 'domicilio',
    metodoPago: 'PUE',
    formaPago: '04',
    usoCFDI: 'S01',
    propinaFacturar: false,
    esGlobalDefault: true,
  },
]

/**
 * Resuelve preset + overrides → parámetros de emisión para el motor fiscal.
 * No duplica reglas: solo mapea a lo que ya usa facturacion.ts.
 */
export function resolverPresetEmision(
  presetId: string,
  overrides: OverridesEmision = {}
): {
  metodoPago: string
  formaPago: string
  usoCFDI: string
  propinaFacturar: boolean
  esFacturaGlobal: boolean
  preset: PresetEmision
  overrides: OverridesEmision
} {
  const preset = PRESETS_EMISION.find((p) => p.id === presetId)
  if (!preset) {
    throw new Error(`Preset no encontrado: ${presetId}`)
  }

  return {
    metodoPago: overrides.metodoPago ?? preset.metodoPago,
    formaPago: overrides.formaPago ?? preset.formaPago,
    usoCFDI: overrides.usoCFDI ?? preset.usoCFDI,
    propinaFacturar: overrides.propinaFacturar ?? preset.propinaFacturar,
    esFacturaGlobal: overrides.esFacturaGlobal ?? preset.esGlobalDefault,
    preset,
    overrides,
  }
}

/**
 * Obtiene presets por tipo de venta (para selectores Modo Fácil).
 */
export function getPresetsPorTipoVenta(tipo: TipoVenta): PresetEmision[] {
  return PRESETS_EMISION.filter((p) => p.tipoVenta === tipo)
}

/**
 * Genera resumen legible para "Vista previa" del asistente.
 */
export function resumenEmision(params: {
  metodoPago: string
  formaPago: string
  usoCFDI: string
  esFacturaGlobal: boolean
}): string {
  const metodo = params.metodoPago === 'PUE' ? 'PUE (Pago en una exhibición)' : 'PPD (Pago en parcialidades)'
  const forma = FORMAS_PAGO.find((f) => f.clave === params.formaPago)
  const uso = USOS_CFDI.find((u) => u.clave === params.usoCFDI)
  const receptor = params.esFacturaGlobal ? 'PÚBLICO EN GENERAL (global)' : 'Nominativa (datos del cliente)'
  return `Se timbrará como: ${metodo} · Forma ${params.formaPago} ${forma?.descripcion ?? ''} · Uso ${params.usoCFDI} ${uso?.descripcion ?? ''} · Receptor: ${receptor}`
}

/**
 * Estructura para log de auditoría (guardar en Factura.detallesEmision).
 */
export interface LogEmisionModoFacil {
  modo: 'facil'
  presetId: string
  overrides: OverridesEmision
  timestamp: string
}
