import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { hashSecretToken } from '@/lib/public-ordering'
import { computeClientOrderEta } from '@/lib/client-order-eta'
import { computeSolicitudClientePhase, labelForSolicitudPhase } from '@/lib/solicitud-seguimiento-phase'

describe('hashSecretToken', () => {
  it('produce hash estable para el mismo token', () => {
    expect(hashSecretToken('abc')).toBe(hashSecretToken('abc'))
    expect(hashSecretToken('abc')).not.toBe(hashSecretToken('abd'))
  })
})

describe('computeClientOrderEta', () => {
  it('sube ETA cuando la carga supera el tope de comandas', () => {
    const low = computeClientOrderEta({
      clienteEtaMinMinutos: 45,
      clienteEtaMaxMinutos: 60,
      activeComandas: 5,
      maxComandasActivas: 10,
      itemsInPrepLoad: 0,
      maxItemsPreparacion: null,
    })
    const high = computeClientOrderEta({
      clienteEtaMinMinutos: 45,
      clienteEtaMaxMinutos: 60,
      activeComandas: 10,
      maxComandasActivas: 10,
      itemsInPrepLoad: 0,
      maxItemsPreparacion: null,
    })
    expect(high.etaMax).toBeGreaterThanOrEqual(low.etaMax)
    expect(high.loadFactor).toBeGreaterThanOrEqual(low.loadFactor)
  })

  it('considera ítems en preparación cuando hay maxItemsPreparacion', () => {
    const a = computeClientOrderEta({
      clienteEtaMinMinutos: 40,
      clienteEtaMaxMinutos: 50,
      activeComandas: 0,
      maxComandasActivas: 100,
      itemsInPrepLoad: 50,
      maxItemsPreparacion: 50,
    })
    expect(a.loadFactor).toBeGreaterThanOrEqual(1)
  })
})

describe('computeSolicitudClientePhase', () => {
  it('devuelve validating para pendiente sin comanda', () => {
    expect(
      computeSolicitudClientePhase({
        estadoSolicitud: 'PENDIENTE',
        approvedComandaId: null,
        comandaEstado: null,
        items: [],
      })
    ).toBe('validating')
  })

  it('devuelve queue para EN_COLA', () => {
    expect(
      computeSolicitudClientePhase({
        estadoSolicitud: 'EN_COLA',
        approvedComandaId: null,
        comandaEstado: null,
        items: [],
      })
    ).toBe('queue')
  })

  it('devuelve preparation con comanda EN_PREPARACION', () => {
    expect(
      computeSolicitudClientePhase({
        estadoSolicitud: 'APROBADA',
        approvedComandaId: 'c1',
        comandaEstado: 'EN_PREPARACION',
        items: [],
      })
    ).toBe('preparation')
  })

  it('devuelve cancelled por RECHAZADA', () => {
    expect(
      computeSolicitudClientePhase({
        estadoSolicitud: 'RECHAZADA',
        approvedComandaId: null,
        comandaEstado: null,
        items: [],
      })
    ).toBe('cancelled')
    expect(labelForSolicitudPhase('cancelled')).toBe('Cancelado')
  })
})

describe('GET seguimiento token', () => {
  it('responde 400 sin token', async () => {
    const { GET } = await import('@/app/api/public/solicitudes/[id]/seguimiento/route')
    const req = new NextRequest(new URL('http://localhost/api/public/solicitudes/x/seguimiento'))
    const res = await GET(req, { params: { id: 'x' } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})
