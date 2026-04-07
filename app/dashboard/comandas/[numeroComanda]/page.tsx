'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/auth-fetch'
import { labelComandaEstado, labelItemEstado } from '@/lib/estado-labels'
import { useParams, useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import toast from 'react-hot-toast'

interface Comanda {
  id: string
  numeroComanda: string
  estado: string
  total: number
  propina: number
  descuento: number
  motivoCancelacion?: string | null
  creadoPor?: {
    nombre: string
    apellido: string
  } | null
  canceladoPor?: {
    nombre: string
    apellido: string
  } | null
  fechaCreacion: string
  mesa?: {
    numero: number
  } | null
  cliente?: {
    nombre: string
  } | null
  items: Array<{
    id: string
    cantidad: number
    producto: {
      nombre: string
      categoria: {
        nombre: string
      }
    }
    tamano?: { nombre: string } | null
    precioUnitario: number
    subtotal: number
    notas?: string
    estado: string
    numeroRonda?: number
  }>
}

interface ClipTerminal {
  id: string
  serialNumber: string
  nombre: string | null
  activo: boolean
  isDefault?: boolean
}

export default function ComandaDetallePage() {
  const params = useParams()
  const router = useRouter()
  const numeroComanda = params.numeroComanda as string

  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [loading, setLoading] = useState(true)
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | null>(null)
  const [cobrandoEfectivo, setCobrandoEfectivo] = useState(false)
  const [cobrandoClip, setCobrandoClip] = useState(false)
  const [serialClip, setSerialClip] = useState('')
  const [terminalesClip, setTerminalesClip] = useState<ClipTerminal[]>([])
  const [propinaClip, setPropinaClip] = useState('')
  const [esperaClip, setEsperaClip] = useState<{ pagoId: string; pinpadId: string } | null>(null)
  const [montoRecibido, setMontoRecibido] = useState('')
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false)
  const [efectivoEsperado, setEfectivoEsperado] = useState<number | null>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [cancelandoComanda, setCancelandoComanda] = useState(false)

  useEffect(() => {
    fetchComanda()
  }, [numeroComanda])

  const loadTerminalesClip = async () => {
    const res = await apiFetch('/api/clip/terminales')
    const data = await res.json()
    if (!data.success) return [] as ClipTerminal[]
    const active = (data.data as ClipTerminal[]).filter((t) => t.activo)
    setTerminalesClip(active)
    return active
  }

  const resolverSerialInicial = (terminales: ClipTerminal[]) => {
    if (terminales.length === 1) return terminales[0].serialNumber
    if (terminales.length > 1) {
      const defaultTerminal = terminales.find((t) => t.isDefault)
      if (defaultTerminal) return defaultTerminal.serialNumber
    }
    return ''
  }

  useEffect(() => {
    loadTerminalesClip()
      .then((active) => setSerialClip(resolverSerialInicial(active)))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (metodoPago === 'efectivo') {
      apiFetch('/api/caja/turno', { headers: {} })
        .then((r) => r.json())
        .then((j) => {
          if (j.success && j.data?.abierto) {
            setEfectivoEsperado(j.data.efectivoEsperado ?? null)
          } else {
            setEfectivoEsperado(null)
          }
        })
        .catch(() => setEfectivoEsperado(null))
    } else {
      setEfectivoEsperado(null)
    }
  }, [metodoPago])

  const fetchComanda = async () => {
    try {
      const response = await apiFetch(`/api/comandas?numeroComanda=${numeroComanda}`, {
        headers: {
                  },
      })

      const data = await response.json()

      if (data.success && data.data.length > 0) {
        setComanda(data.data[0])
      } else {
        toast.error('Comanda no encontrada')
        router.push('/dashboard/mesas')
      }
    } catch (error) {
      toast.error('Error al cargar comanda')
    } finally {
      setLoading(false)
    }
  }

  const handleCobrarEfectivo = async () => {
    if (!comanda) return
    const totalCobro = comanda.total * (1 + (comanda.propina || 0) / 100) - (comanda.descuento || 0)
    const recibido = parseFloat(montoRecibido.replace(/,/g, '.'))
    if (isNaN(recibido) || recibido < totalCobro) {
      toast.error('El monto recibido debe ser mayor o igual al total a cobrar')
      return
    }
    setCobrandoEfectivo(true)
    try {
      const response = await apiFetch('/api/pagos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comandaId: comanda.id,
          metodo: 'efectivo',
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Pago en efectivo registrado')
        setMetodoPago(null)
        fetchComanda()
      } else {
        toast.error(data.error ?? 'Error al registrar pago')
      }
    } catch (error) {
      toast.error('Error al registrar pago')
    } finally {
      setCobrandoEfectivo(false)
    }
  }

  const handleEnviarCobroClip = async () => {
    if (!comanda) return
    if (!serialClip.trim()) {
      toast.error('Selecciona una terminal para cobrar con tarjeta')
      return
    }
    setCobrandoClip(true)
    try {
      const tip = propinaClip ? parseFloat(propinaClip.replace(',', '.')) : 0
      const res = await apiFetch('/api/clip/crear-intencion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comandaId: comanda.id,
          serialNumber: serialClip.trim(),
          tipAmount: Number.isFinite(tip) && tip > 0 ? tip : undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error ?? 'No se pudo enviar el cobro a Clip')
        return
      }
      const pin = data.data?.pinpadRequestId as string | null
      if (!pin) {
        toast.success('Cobro enviado. Espera confirmación desde la terminal.')
        return
      }
      setEsperaClip({ pagoId: data.data.pagoId as string, pinpadId: pin })
      toast.success('Cobro enviado a Clip. Esperando confirmación...')
    } catch {
      toast.error('Error al enviar cobro con Clip')
    } finally {
      setCobrandoClip(false)
    }
  }

  const handleSeleccionarTarjeta = async () => {
    const active = await loadTerminalesClip()
    if (active.length === 0) {
      toast.error('No hay terminales activas. Configura Clip antes de cobrar con tarjeta.')
      router.push('/dashboard/configuracion')
      return
    }
    const resolvedSerial = resolverSerialInicial(active)
    setSerialClip(resolvedSerial)
    if (active.length > 1 && !resolvedSerial) {
      toast('Selecciona una terminal para continuar')
    } else if (active.length > 1 && resolvedSerial) {
      const defaultTerminal = active.find((t) => t.serialNumber === resolvedSerial)
      if (defaultTerminal) {
        toast.success(`Usando terminal predeterminada${defaultTerminal.nombre ? `: ${defaultTerminal.nombre}` : ''}`)
      }
    }
    setMetodoPago('tarjeta')
  }

  useEffect(() => {
    if (!esperaClip) return
    const t = setInterval(async () => {
      const res = await apiFetch(
        `/api/clip/estado?pagoId=${encodeURIComponent(esperaClip.pagoId)}&pinpadRequestId=${encodeURIComponent(esperaClip.pinpadId)}`
      )
      const data = await res.json()
      if (data.success && data.data?.status === 'COMPLETADO') {
        toast.success('Pago con Clip completado')
        setEsperaClip(null)
        setMetodoPago(null)
        setSerialClip('')
        setPropinaClip('')
        fetchComanda()
      }
    }, 3500)
    return () => clearInterval(t)
  }, [esperaClip])

  const handleConfirmarEntrega = async () => {
    if (!comanda || !hayItemsListos) return
    setConfirmandoEntrega(true)
    try {
      const res = await apiFetch(`/api/comandas/${comanda.id}/entregar`, {
        method: 'POST',
        headers: {},
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Entrega confirmada')
        fetchComanda()
      } else {
        toast.error(data.error ?? 'Error al confirmar entrega')
      }
    } catch {
      toast.error('Error al confirmar entrega')
    } finally {
      setConfirmandoEntrega(false)
    }
  }

  const handleCancelarComanda = async () => {
    if (!comanda) return
    const motivo = motivoCancelacion.trim()
    if (!motivo) {
      toast.error('Escribe el motivo de la cancelación')
      return
    }

    setCancelandoComanda(true)
    try {
      const response = await apiFetch(`/api/comandas/${comanda.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estado: 'CANCELADO',
          motivoCancelacion: motivo,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.error || 'No se pudo cancelar la comanda')
        return
      }

      toast.success('Comanda cancelada y mesa liberada')
      setMotivoCancelacion('')
      fetchComanda()
    } catch {
      toast.error('Error al cancelar la comanda')
    } finally {
      setCancelandoComanda(false)
    }
  }

  if (loading) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">Cargando...</div>
      </div>
    )
  }

  if (!comanda) return null

  const itemsListos = comanda.items.filter((i) => i.estado === 'LISTO')
  const hayItemsListos = itemsListos.length > 0
  const itemsPorRonda = comanda.items.reduce<Record<number, Comanda['items']>>((acc, item) => {
    const ronda = item.numeroRonda || 1
    if (!acc[ronda]) acc[ronda] = []
    acc[ronda].push(item)
    return acc
  }, {})
  const rondasOrdenadas = Object.entries(itemsPorRonda)
    .map(([ronda, items]) => ({ ronda: Number(ronda), items }))
    .sort((a, b) => a.ronda - b.ronda)

  const totalConPropina = comanda.total * (1 + (comanda.propina || 0) / 100)
  const totalFinal = totalConPropina - (comanda.descuento || 0)
  const montoRecibidoNum = parseFloat(montoRecibido.replace(/,/g, '.')) || 0
  const cambio = montoRecibidoNum >= totalFinal ? montoRecibidoNum - totalFinal : 0

  return (
    <div className="app-page">
      <div className="app-card mb-6">
        <BackButton className="mb-4" />
        <p className="app-kicker">Detalle de comanda</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">
          Comanda {comanda.numeroComanda}
        </h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-600">
          <span>
            {comanda.mesa ? `Mesa ${comanda.mesa.numero}` : 'Para llevar'}
          </span>
          <span>Estado: {labelComandaEstado(comanda.estado)}</span>
          {comanda.creadoPor && (
            <span>
              Creada por: {`${comanda.creadoPor.nombre} ${comanda.creadoPor.apellido}`.trim()}
            </span>
          )}
        </div>
        {comanda.estado === 'CANCELADO' && comanda.motivoCancelacion && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <strong>Motivo de cancelación:</strong> {comanda.motivoCancelacion}
            {comanda.canceladoPor && (
            <div className="mt-1 text-rose-900">
                <strong>Cancelada por:</strong>{' '}
                {`${comanda.canceladoPor.nombre} ${comanda.canceladoPor.apellido}`.trim()}
              </div>
            )}
          </div>
        )}
      </div>

      {hayItemsListos && (
        <div className="app-card mb-6 border-sky-200 bg-sky-50/50 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sky-800">
              <strong>{itemsListos.length}</strong> {itemsListos.length === 1 ? 'item listo' : 'items listos'} en cocina/barra. Confirma cuando los entregues a la mesa.
            </p>
            <button
              onClick={handleConfirmarEntrega}
              disabled={confirmandoEntrega}
              className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {confirmandoEntrega ? 'Confirmando…' : 'Confirmar entrega'}
            </button>
          </div>
        </div>
      )}

      <div className="app-card mb-6 p-6">
        <h2 className="mb-4 text-xl font-semibold text-stone-900">Items</h2>
        <div className="space-y-5">
          {rondasOrdenadas.map(({ ronda, items }) => (
            <div key={ronda} className="rounded-xl border border-stone-200 p-4">
              <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-600">
                Envio {ronda}
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="flex-1">
                      <div className="font-semibold text-stone-900">
                        {item.cantidad}x {item.producto.nombre}
                        {item.tamano && (
                          <span className="font-normal text-stone-600"> - {item.tamano.nombre}</span>
                        )}
                      </div>
                      <div className="text-sm text-stone-600">{item.producto.categoria.nombre}</div>
                      {item.notas && <div className="mt-1 text-sm text-rose-700">Nota: {item.notas}</div>}
                      <div className="mt-1 text-sm text-stone-500">
                        Estado: {labelItemEstado(item.estado)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${item.subtotal.toFixed(2)}</div>
                      <div className="text-sm text-stone-600">${item.precioUnitario.toFixed(2)} c/u</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${comanda.total.toFixed(2)}</span>
          </div>
          {comanda.propina > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>Propina ({comanda.propina}%):</span>
              <span>${(comanda.total * comanda.propina / 100).toFixed(2)}</span>
            </div>
          )}
          {comanda.descuento > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Descuento:</span>
              <span>-${comanda.descuento.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold border-t pt-2">
            <span>Total:</span>
            <span>${totalFinal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {comanda.estado !== 'PAGADO' && (
        <div className="app-card mb-6 p-6">
          <h2 className="mb-4 text-xl font-semibold text-stone-900">Métodos de pago</h2>
          {!comanda.items.every(
            (i) => i.estado === 'LISTO' || i.estado === 'ENTREGADO'
          ) ? (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              No se puede cobrar hasta que todos los productos estén marcados
              como listos en cocina.
            </p>
          ) : metodoPago === null ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMetodoPago('efectivo')}
                className="app-btn-secondary flex items-center gap-2 rounded-2xl px-5 py-3"
              >
                <span className="text-2xl">💵</span>
                Efectivo
              </button>
              <button
                type="button"
                onClick={handleSeleccionarTarjeta}
                className="app-btn-secondary flex items-center gap-2 rounded-2xl px-5 py-3"
              >
                <span className="text-2xl">💳</span>
                Tarjeta
              </button>
            </div>
          ) : metodoPago === 'efectivo' ? (
            <div className="space-y-4">
              <p className="text-stone-600">
                Total a cobrar: <strong>${totalFinal.toFixed(2)}</strong>
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Monto recibido</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  placeholder="0.00"
                  className="app-input app-field max-w-xs text-lg"
                />
              </div>
              {montoRecibidoNum >= totalFinal && montoRecibidoNum > 0 && (
                <>
                  <p className="rounded-2xl bg-green-50 px-4 py-2 text-lg font-semibold text-green-700">
                    Cambio a devolver: <strong>${cambio.toFixed(2)}</strong>
                  </p>
                  {efectivoEsperado != null && efectivoEsperado < cambio && (
                    <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                      Posible efectivo insuficiente para dar cambio. Efectivo esperado en caja: $
                      {efectivoEsperado.toFixed(2)}. Considera reforzar la caja antes de cobrar.
                    </p>
                  )}
                </>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCobrarEfectivo}
                  disabled={cobrandoEfectivo || montoRecibidoNum < totalFinal}
                  className="app-btn-primary rounded-2xl px-6 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cobrandoEfectivo ? 'Registrando…' : 'Cobrar en efectivo'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMetodoPago(null); setMontoRecibido('') }}
                  className="app-btn-secondary rounded-2xl px-6 py-2"
                >
                  Cambiar método
                </button>
              </div>
            </div>
          ) : metodoPago === 'tarjeta' ? (
            <div className="space-y-4 max-w-md">
              <p className="text-stone-600">
                Total a cobrar: <strong>${totalFinal.toFixed(2)}</strong>
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Terminal</label>
                <select
                  value={serialClip}
                  onChange={(e) => setSerialClip(e.target.value)}
                  className="app-input app-field w-full"
                >
                  <option value="">Selecciona una terminal</option>
                  {terminalesClip.map((t) => (
                    <option key={t.id} value={t.serialNumber}>
                      {t.nombre ? `${t.nombre} · ${t.serialNumber}` : t.serialNumber}
                      {t.isDefault ? ' (Predeterminada)' : ''}
                    </option>
                  ))}
                </select>
                {terminalesClip.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No hay terminales registradas. Agrégalas en Configuración para poder cobrar con tarjeta.
                  </p>
                )}
                {terminalesClip.length > 1 && !serialClip && (
                  <p className="mt-1 text-xs text-amber-700">
                    Selecciona una terminal para continuar con el cobro.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Propina extra en terminal (opcional)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={propinaClip}
                  onChange={(e) => setPropinaClip(e.target.value)}
                  placeholder="0.00"
                  className="app-input app-field w-full"
                />
              </div>
              {esperaClip && (
                <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Cobro enviado a terminal. Esperando confirmación...
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleEnviarCobroClip}
                  disabled={cobrandoClip || !!esperaClip || !serialClip}
                  className="app-btn-primary rounded-2xl px-6 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cobrandoClip ? 'Enviando...' : 'Enviar cobro con tarjeta'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMetodoPago(null)
                    setEsperaClip(null)
                    setSerialClip('')
                    setPropinaClip('')
                  }}
                  className="app-btn-secondary rounded-2xl px-6 py-2"
                >
                  Cambiar método
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {comanda.estado !== 'PAGADO' && comanda.estado !== 'CANCELADO' && (
        <div className="app-card mb-6 border-rose-200 bg-rose-50/40 p-6">
          <h2 className="mb-2 text-xl font-semibold text-rose-900">Cancelar comanda</h2>
          <p className="text-sm text-rose-800 mb-4">
            Usa esta opción cuando el cliente se retira antes de preparar los productos.
            El motivo quedará registrado en historial y reportes.
          </p>
          <label className="block text-sm font-medium text-rose-900 mb-1">Motivo de cancelación</label>
          <textarea
            value={motivoCancelacion}
            onChange={(event) => setMotivoCancelacion(event.target.value)}
            rows={3}
            className="app-input w-full"
            placeholder="Ej. Cliente se retiró por espera prolongada. No iniciar preparación."
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleCancelarComanda}
              disabled={cancelandoComanda || !motivoCancelacion.trim()}
              className="app-btn-danger rounded-lg px-5 py-2 disabled:opacity-50"
            >
              {cancelandoComanda ? 'Cancelando...' : 'Cancelar comanda'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-wrap">
        {comanda.estado !== 'PAGADO' && comanda.estado !== 'CANCELADO' && (
          <button
            onClick={() => router.push(`/dashboard/comandas/nueva?comandaId=${comanda.id}`)}
            className="app-btn-primary rounded-2xl px-6 py-2"
          >
            + Agregar más pedidos
          </button>
        )}
        <button
          onClick={() => router.push('/dashboard/mesas')}
          className="app-btn-secondary rounded-2xl px-6 py-2"
        >
          Volver a Mesas
        </button>
      </div>
    </div>
  )
}








