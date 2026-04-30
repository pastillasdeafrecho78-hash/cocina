export type MesaDashboard = {
  id: string
  numero: number
  estado: 'LIBRE' | 'OCUPADA' | 'CUENTA_PEDIDA' | 'RESERVADA'
  capacidad: number
  ubicacion?: string | null
  piso?: string | null
  posicionX?: number | null
  posicionY?: number | null
  rotacion?: number | null
  forma?: 'RECTANGULAR' | 'CIRCULAR' | null
  ancho?: number | null
  alto?: number | null
  comandaActual?: {
    numeroComanda: string
    total: number
    fechaCreacion?: string
    allItemsEntregados?: boolean
    asignadoA?: { id: string; nombre: string; apellido: string } | null
  } | null
}

export type MesasDashboardView = 'lista' | 'plano'
