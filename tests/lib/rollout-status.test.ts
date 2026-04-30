import { describe, expect, it } from 'vitest'
import { getRolloutFlagStatus } from '@/lib/rollout/status'

describe('rollout status', () => {
  it('detecta flags activos solo con 1 o true', () => {
    const flags = getRolloutFlagStatus({
      NEXT_PUBLIC_KDS_SECCIONES_CONFIGURABLES: '1',
      NEXT_PUBLIC_INVENTARIO_MVP: 'true',
      NEXT_PUBLIC_REEMBOLSOS_CAJA: '0',
      NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO: '',
      TIEMPOS_EVENTOS_ITEM: 'false',
      NEXT_PUBLIC_TIEMPOS_EVENTOS_ITEM: '1',
    } as unknown as NodeJS.ProcessEnv)

    expect(flags.find((flag) => flag.key === 'NEXT_PUBLIC_KDS_SECCIONES_CONFIGURABLES')?.enabled).toBe(true)
    expect(flags.find((flag) => flag.key === 'NEXT_PUBLIC_INVENTARIO_MVP')?.enabled).toBe(true)
    expect(flags.find((flag) => flag.key === 'NEXT_PUBLIC_REEMBOLSOS_CAJA')?.enabled).toBe(false)
    expect(flags.find((flag) => flag.key === 'NEXT_PUBLIC_MESAS_LAYOUT_AVANZADO')?.enabled).toBe(false)
    expect(flags.find((flag) => flag.key === 'TIEMPOS_EVENTOS_ITEM')?.enabled).toBe(false)
    expect(flags.find((flag) => flag.key === 'NEXT_PUBLIC_TIEMPOS_EVENTOS_ITEM')?.enabled).toBe(true)
  })
})
