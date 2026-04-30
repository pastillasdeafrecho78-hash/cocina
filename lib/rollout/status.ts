import { prisma } from '@/lib/prisma'

export type RolloutFlagKey =
  | 'NEXT_PUBLIC_KDS_SECCIONES_CONFIGURABLES'
  | 'NEXT_PUBLIC_INVENTARIO_MVP'
  | 'NEXT_PUBLIC_REEMBOLSOS_CAJA'
  | 'NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO'
  | 'TIEMPOS_EVENTOS_ITEM'
  | 'NEXT_PUBLIC_TIEMPOS_EVENTOS_ITEM'

export interface RolloutFlagStatus {
  key: RolloutFlagKey
  enabled: boolean
  value: 'set' | 'unset'
}

export interface RolloutSchemaCheck {
  key: string
  label: string
  ok: boolean
  hint: string
}

export interface RolloutStatus {
  ok: boolean
  generatedAt: string
  flags: RolloutFlagStatus[]
  schema: RolloutSchemaCheck[]
  nextSteps: string[]
}

const FLAG_KEYS: RolloutFlagKey[] = [
  'NEXT_PUBLIC_KDS_SECCIONES_CONFIGURABLES',
  'NEXT_PUBLIC_INVENTARIO_MVP',
  'NEXT_PUBLIC_REEMBOLSOS_CAJA',
  'NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO',
  'TIEMPOS_EVENTOS_ITEM',
  'NEXT_PUBLIC_TIEMPOS_EVENTOS_ITEM',
]

function isEnabled(value: string | undefined) {
  return value === '1' || value === 'true'
}

export function getRolloutFlagStatus(env: NodeJS.ProcessEnv = process.env): RolloutFlagStatus[] {
  return FLAG_KEYS.map((key) => ({
    key,
    enabled: isEnabled(env[key]),
    value: env[key] ? 'set' : 'unset',
  }))
}

function buildSchemaCheck(key: string, label: string, ok: boolean, hint: string): RolloutSchemaCheck {
  return { key, label, ok, hint }
}

export async function getRolloutSchemaStatus(): Promise<RolloutSchemaCheck[]> {
  const rows = await prisma.$queryRaw<Array<{ key: string; ok: boolean }>>`
    SELECT 'KdsSeccion_table' AS key, EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'KdsSeccion'
    ) AS ok
    UNION ALL
    SELECT 'Producto_kdsSeccionId_column' AS key, EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Producto' AND column_name = 'kdsSeccionId'
    ) AS ok
    UNION ALL
    SELECT 'InventarioArticulo_table' AS key, EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'InventarioArticulo'
    ) AS ok
    UNION ALL
    SELECT 'InventarioMovimiento_table' AS key, EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'InventarioMovimiento'
    ) AS ok
    UNION ALL
    SELECT 'Reembolso_table' AS key, EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'Reembolso'
    ) AS ok
    UNION ALL
    SELECT 'Mesa_layout_columns' AS key, (
      SELECT COUNT(*) = 4 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Mesa'
        AND column_name IN ('forma', 'ancho', 'alto', 'rotacion')
    ) AS ok
    UNION ALL
    SELECT 'ItemTiempoEvento_table' AS key, EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ItemTiempoEvento'
    ) AS ok
  `
  const byKey = new Map(rows.map((row) => [row.key, Boolean(row.ok)]))

  return [
    buildSchemaCheck(
      'KdsSeccion_table',
      'Tabla KdsSeccion',
      byKey.get('KdsSeccion_table') === true,
      'Aplica la migración 20260428120000_kds_secciones_configurables.'
    ),
    buildSchemaCheck(
      'Producto_kdsSeccionId_column',
      'Producto.kdsSeccionId',
      byKey.get('Producto_kdsSeccionId_column') === true,
      'Aplica la migración KDS configurable antes de activar el selector.'
    ),
    buildSchemaCheck(
      'InventarioArticulo_table',
      'Tabla InventarioArticulo',
      byKey.get('InventarioArticulo_table') === true,
      'Aplica la migración 20260428143000_inventario_manual_mvp.'
    ),
    buildSchemaCheck(
      'InventarioMovimiento_table',
      'Tabla InventarioMovimiento',
      byKey.get('InventarioMovimiento_table') === true,
      'Aplica la migración 20260428143000_inventario_manual_mvp.'
    ),
    buildSchemaCheck(
      'Reembolso_table',
      'Tabla Reembolso',
      byKey.get('Reembolso_table') === true,
      'Aplica la migración 20260429100000_reembolsos_caja.'
    ),
    buildSchemaCheck(
      'Mesa_layout_columns',
      'Columnas visuales de Mesa',
      byKey.get('Mesa_layout_columns') === true,
      'Aplica la migración 20260429110000_mesas_layout_avanzado.'
    ),
    buildSchemaCheck(
      'ItemTiempoEvento_table',
      'Tabla ItemTiempoEvento',
      byKey.get('ItemTiempoEvento_table') === true,
      'Aplica la migración 20260429123000_item_tiempo_eventos.'
    ),
  ]
}

export async function getRolloutStatus(): Promise<RolloutStatus> {
  const flags = getRolloutFlagStatus()
  const schema = await getRolloutSchemaStatus()
  const missingFlags = flags.filter((flag) => !flag.enabled)
  const missingSchema = schema.filter((check) => !check.ok)
  const nextSteps = [
    ...missingSchema.map((check) => check.hint),
    ...missingFlags.map((flag) => `Activa ${flag.key}=1 en Vercel si ese módulo debe estar visible.`),
  ]

  return {
    ok: missingFlags.length === 0 && missingSchema.length === 0,
    generatedAt: new Date().toISOString(),
    flags,
    schema,
    nextSteps,
  }
}
