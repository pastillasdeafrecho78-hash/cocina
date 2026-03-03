'use client'

import { useState } from 'react'
import {
  PRESETS_EMISION,
  resolverPresetEmision,
  resumenEmision,
  type TipoVenta,
  type OverridesEmision,
  type LogEmisionModoFacil,
} from '@/lib/presets-fiscales'
import { USOS_CFDI } from '@/lib/catalogos-sat'

export interface AsistenteFacturacionProps {
  /** Si el cliente tiene datos fiscales (RFC, etc.) para nominativa */
  tieneClienteConDatos?: boolean
  /** Propina ya definida en la comanda (monto o %). Solo informativo para override. */
  propinaComanda?: number
  onTimbrar: (params: {
    metodoPago: string
    formaPago: string
    usoCFDI: string
    esFacturaGlobal: boolean
    presetId: string
    overrides: OverridesEmision
    log: LogEmisionModoFacil
  }) => void | Promise<void>
  onCancelar?: () => void
  loading?: boolean
}

const PASOS = 3

export default function AsistenteFacturacion({
  tieneClienteConDatos = false,
  propinaComanda = 0,
  onTimbrar,
  onCancelar,
  loading = false,
}: AsistenteFacturacionProps) {
  const [paso, setPaso] = useState(1)
  const [esGlobal, setEsGlobal] = useState(!tieneClienteConDatos)
  const [presetId, setPresetId] = useState(PRESETS_EMISION[0].id)
  const [overrides, setOverrides] = useState<OverridesEmision>({})
  const [usoCFDIOverride, setUsoCFDIOverride] = useState<string | null>(null)
  const [propinaOverride, setPropinaOverride] = useState<boolean | null>(null)

  const resuelto = (() => {
    try {
      const r = resolverPresetEmision(presetId, {
        ...overrides,
        esFacturaGlobal: esGlobal,
        usoCFDI: usoCFDIOverride ?? undefined,
        propinaFacturar: propinaOverride ?? undefined,
      })
      return r
    } catch {
      return null
    }
  })()

  const handleSiguiente = () => {
    if (paso < PASOS) setPaso(paso + 1)
  }

  const handleAnterior = () => {
    if (paso > 1) setPaso(paso - 1)
  }

  const handleTimbrar = async () => {
    if (!resuelto) return
    const log: LogEmisionModoFacil = {
      modo: 'facil',
      presetId,
      overrides: {
        ...overrides,
        esFacturaGlobal: esGlobal,
        usoCFDI: usoCFDIOverride ?? undefined,
        propinaFacturar: propinaOverride ?? undefined,
      },
      timestamp: new Date().toISOString(),
    }
    await onTimbrar({
      metodoPago: resuelto.metodoPago,
      formaPago: resuelto.formaPago,
      usoCFDI: resuelto.usoCFDI,
      esFacturaGlobal: resuelto.esFacturaGlobal,
      presetId,
      overrides: log.overrides,
      log,
    })
  }

  return (
    <div className="space-y-6 text-black">
      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-2 flex-1 rounded-full ${
              paso >= n ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Paso 1: ¿Global o Nominativa? */}
      {paso === 1 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            1. ¿Factura global o nominativa?
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Global: sin datos del cliente (PÚBLICO EN GENERAL). Nominativa: con RFC y datos del cliente.
          </p>
          <div className="space-y-3">
            <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="global"
                checked={esGlobal}
                onChange={() => setEsGlobal(true)}
                className="mt-1 mr-3"
              />
              <div>
                <span className="font-medium">Global</span>
                <p className="text-sm text-gray-500">
                  Sin datos del cliente. Se usará PÚBLICO EN GENERAL.
                </p>
              </div>
            </label>
            <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="global"
                checked={!esGlobal}
                onChange={() => setEsGlobal(false)}
                className="mt-1 mr-3"
                disabled={!tieneClienteConDatos}
              />
              <div>
                <span className="font-medium">Nominativa</span>
                <p className="text-sm text-gray-500">
                  Con datos del cliente (RFC, nombre, etc.).
                  {!tieneClienteConDatos && (
                    <span className="text-amber-600 block mt-1">
                      No hay datos fiscales del cliente. Completa RFC y datos para usar nominativa.
                    </span>
                  )}
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Paso 2: ¿Cómo se pagó? */}
      {paso === 2 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            2. ¿Cómo se pagó?
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Elige el escenario que coincide con esta venta.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {PRESETS_EMISION.map((p) => (
              <label
                key={p.id}
                className={`flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  presetId === p.id ? 'ring-2 ring-blue-500 border-blue-500' : ''
                }`}
              >
                <input
                  type="radio"
                  name="preset"
                  checked={presetId === p.id}
                  onChange={() => setPresetId(p.id)}
                  className="mt-1 mr-3"
                />
                <div>
                  <span className="font-medium">{p.nombre}</span>
                  <p className="text-sm text-gray-500">{p.descripcion}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uso CFDI (editable)
            </label>
            <select
              value={usoCFDIOverride ?? resuelto?.usoCFDI ?? 'S01'}
              onChange={(e) => setUsoCFDIOverride(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            >
              {USOS_CFDI.map((u) => (
                <option key={u.clave} value={u.clave}>
                  {u.clave} – {u.descripcion}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Paso 3: Propina + Vista previa */}
      {paso === 3 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            3. Propina
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            ¿Incluir propina en esta factura? Puedes sobreescribir la política del restaurante para esta emisión.
          </p>
          <div className="space-y-2 mb-6">
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="propina"
                checked={propinaOverride === false}
                onChange={() => setPropinaOverride(false)}
                className="mr-3"
              />
              <span>No facturar propina</span>
            </label>
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="propina"
                checked={propinaOverride === true}
                onChange={() => setPropinaOverride(true)}
                className="mr-3"
              />
              <span>Facturar propina como concepto</span>
            </label>
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="propina"
                checked={propinaOverride === null}
                onChange={() => setPropinaOverride(null)}
                className="mr-3"
              />
              <span>Usar política del restaurante</span>
            </label>
          </div>

          {resuelto && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-2">Vista previa</h4>
              <p className="text-sm text-blue-800">
                {resumenEmision({
                  metodoPago: resuelto.metodoPago,
                  formaPago: resuelto.formaPago,
                  usoCFDI: usoCFDIOverride ?? resuelto.usoCFDI,
                  esFacturaGlobal: resuelto.esFacturaGlobal,
                })}
              </p>
              {propinaComanda > 0 && (
                <p className="text-sm text-blue-700 mt-2">
                  Propina en comanda: ${propinaComanda.toFixed(2)} ·{' '}
                  {propinaOverride === true
                    ? 'Se facturará'
                    : propinaOverride === false
                    ? 'No se facturará'
                    : 'Según configuración'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <div>
          {paso > 1 && (
            <button
              type="button"
              onClick={handleAnterior}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Anterior
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {onCancelar && (
            <button
              type="button"
              onClick={onCancelar}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </button>
          )}
          {paso < PASOS ? (
            <button
              type="button"
              onClick={handleSiguiente}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTimbrar}
              disabled={loading || !resuelto}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Timbrando…' : 'Timbrar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
