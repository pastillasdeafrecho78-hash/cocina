/**
 * Utilidades para manejo de polígonos y cuadrículas
 */

export interface Point {
  x: number
  y: number
}

export interface Edge {
  from: number
  to: number
}

export interface Polygon {
  vertices: Point[]
  edges: Edge[]
}

const CELL_SIZE_M = 1.0 // Tamaño de celda en metros (configurable)

/**
 * Cuantiza una posición en metros a coordenadas de celda
 */
export function quantize(posM: Point, cellSizeM: number = CELL_SIZE_M): Point {
  return {
    x: Math.round(posM.x / cellSizeM),
    y: Math.round(posM.y / cellSizeM),
  }
}

/**
 * Convierte coordenadas de celda a metros
 */
export function dequantize(cell: Point, cellSizeM: number = CELL_SIZE_M): Point {
  return {
    x: cell.x * cellSizeM,
    y: cell.y * cellSizeM,
  }
}

/**
 * Verifica si dos puntos están en la misma celda
 */
export function isSameCell(p1: Point, p2: Point): boolean {
  return p1.x === p2.x && p1.y === p2.y
}

/**
 * Calcula la distancia entre dos puntos
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
}

/**
 * Verifica si dos segmentos de línea se intersectan
 * Usa el algoritmo de intersección de segmentos
 */
export function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  const ccw = (A: Point, B: Point, C: Point): boolean => {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x)
  }

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  )
}

/**
 * Verifica si una nueva arista se intersecta con aristas existentes
 * (excluyendo las aristas adyacentes)
 */
export function checkSelfIntersection(
  vertices: Point[],
  edges: Edge[],
  newVertexIndex: number
): boolean {
  if (vertices.length < 3) return false

  const newVertex = vertices[newVertexIndex]
  const prevVertex = vertices[newVertexIndex - 1]

  // Verificar intersección con todas las aristas excepto las adyacentes
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i]
    const edgeStart = vertices[edge.from]
    const edgeEnd = vertices[edge.to]

    // Saltar aristas adyacentes
    if (
      edge.from === newVertexIndex - 1 ||
      edge.to === newVertexIndex - 1 ||
      edge.from === newVertexIndex ||
      edge.to === newVertexIndex
    ) {
      continue
    }

    // Verificar intersección
    if (segmentsIntersect(prevVertex, newVertex, edgeStart, edgeEnd)) {
      return true
    }
  }

  return false
}

/**
 * Cierra un polígono agregando la arista final del último vértice al primero
 */
export function closePolygon(vertices: Point[], edges: Edge[]): Edge[] {
  if (vertices.length < 3) {
    throw new Error('Se requieren al menos 3 puntos para cerrar un polígono')
  }

  const newEdges = [...edges]
  const lastIndex = vertices.length - 1

  // Verificar si ya está cerrado
  const isAlreadyClosed = edges.some(
    (e) => (e.from === lastIndex && e.to === 0) || (e.from === 0 && e.to === lastIndex)
  )

  if (!isAlreadyClosed) {
    newEdges.push({ from: lastIndex, to: 0 })
  }

  return newEdges
}

/**
 * Calcula el área de un polígono usando la fórmula del shoelace
 */
export function polygonArea(vertices: Point[]): number {
  if (vertices.length < 3) return 0

  let area = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }

  return Math.abs(area / 2)
}

/**
 * Calcula el perímetro de un polígono
 */
export function polygonPerimeter(vertices: Point[], edges: Edge[]): number {
  let perimeter = 0
  for (const edge of edges) {
    const start = vertices[edge.from]
    const end = vertices[edge.to]
    perimeter += distance(start, end)
  }
  return perimeter
}

/**
 * Calcula las dimensiones del bounding box del polígono
 */
export function polygonBounds(vertices: Point[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
} {
  if (vertices.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 }
  }

  const xs = vertices.map((v) => v.x)
  const ys = vertices.map((v) => v.y)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Simplifica un polígono usando el algoritmo de Ramer-Douglas-Peucker
 * (opcional, para suavizar puntos muy "dentados")
 */
export function simplifyPolygon(
  vertices: Point[],
  epsilon: number = 0.5
): Point[] {
  if (vertices.length <= 2) return vertices

  // Encuentra el punto más lejano del segmento
  let maxDistance = 0
  let maxIndex = 0
  const start = vertices[0]
  const end = vertices[vertices.length - 1]

  for (let i = 1; i < vertices.length - 1; i++) {
    const dist = pointToLineDistance(vertices[i], start, end)
    if (dist > maxDistance) {
      maxDistance = dist
      maxIndex = i
    }
  }

  // Si la distancia máxima es mayor que epsilon, recursivamente simplificar
  if (maxDistance > epsilon) {
    const left = simplifyPolygon(vertices.slice(0, maxIndex + 1), epsilon)
    const right = simplifyPolygon(vertices.slice(maxIndex), epsilon)

    // Combinar resultados (sin duplicar el punto de unión)
    return [...left.slice(0, -1), ...right]
  } else {
    // Si todos los puntos están cerca de la línea, devolver solo los extremos
    return [start, end]
  }
}

/**
 * Calcula la distancia de un punto a un segmento de línea
 */
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x
  const B = point.y - lineStart.y
  const C = lineEnd.x - lineStart.x
  const D = lineEnd.y - lineStart.y

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1

  if (lenSq !== 0) param = dot / lenSq

  let xx: number, yy: number

  if (param < 0) {
    xx = lineStart.x
    yy = lineStart.y
  } else if (param > 1) {
    xx = lineEnd.x
    yy = lineEnd.y
  } else {
    xx = lineStart.x + param * C
    yy = lineStart.y + param * D
  }

  const dx = point.x - xx
  const dy = point.y - yy
  return Math.sqrt(dx * dx + dy * dy)
}
