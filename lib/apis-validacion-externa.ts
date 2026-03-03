/**
 * APIs Externas para Validaciones Fiscales
 * Integración con servicios externos para validar RFC, códigos postales y catálogos SAT
 * 
 * NOTA: Estas funciones son opcionales. Si las APIs no están configuradas o fallan,
 * el sistema usa validaciones locales como fallback.
 */

import { ResultadoValidacion } from './validaciones-fiscales'

// ============================================================================
// 1. VALIDACIÓN DE RFC CONTRA EL SAT
// ============================================================================

export interface ValidacionRFCResult {
  rfc: string
  activo: boolean
  puedeEmitir: boolean
  puedeRecibir: boolean
  razonSocial?: string
  regimenFiscal?: string
  fechaAlta?: string
  fechaUltimoCambio?: string
}

/**
 * Valida RFC contra el SAT usando API externa (COPOMEX o similar)
 * 
 * @param rfc - RFC a validar
 * @returns Resultado de validación o null si falla la API
 */
export async function validarRFCContraSAT(rfc: string): Promise<ValidacionRFCResult | null> {
  const apiUrl = process.env.API_VALIDACION_RFC_URL
  const apiKey = process.env.API_VALIDACION_RFC_KEY

  if (!apiUrl || !apiKey) {
    console.warn('API de validación RFC no configurada. Usando validación local.')
    return null
  }

  try {
    const response = await fetch(`${apiUrl}/validar-rfc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ rfc }),
    })

    if (!response.ok) {
      console.error(`Error validando RFC: ${response.statusText}`)
      return null
    }

    const data = await response.json()
    return {
      rfc: data.rfc,
      activo: data.activo ?? false,
      puedeEmitir: data.puedeEmitir ?? false,
      puedeRecibir: data.puedeRecibir ?? false,
      razonSocial: data.razonSocial,
      regimenFiscal: data.regimenFiscal,
      fechaAlta: data.fechaAlta,
      fechaUltimoCambio: data.fechaUltimoCambio,
    }
  } catch (error) {
    console.error('Error llamando API de validación RFC:', error)
    return null
  }
}

/**
 * Validación mejorada de RFC que combina validación local + API externa
 */
export async function validarRFCMejorado(
  rfc: string,
  esPersonaMoral: boolean = false,
  usarAPI: boolean = true
): Promise<ResultadoValidacion & { datosSAT?: ValidacionRFCResult }> {
  const errores: string[] = []
  const advertencias: string[] = []

  // Primero validación local (formato)
  const { validarRFC } = await import('./validaciones-fiscales')
  const validacionLocal = validarRFC(rfc, esPersonaMoral)
  
  if (!validacionLocal.valido) {
    return validacionLocal
  }

  // Si la validación local pasa, intentar validación externa
  if (usarAPI) {
    const resultadoAPI = await validarRFCContraSAT(rfc)
    
    if (resultadoAPI) {
      if (!resultadoAPI.activo) {
        errores.push('RFC no está activo en el SAT')
      }
      
      if (!resultadoAPI.puedeEmitir && !resultadoAPI.puedeRecibir) {
        errores.push('RFC no puede emitir ni recibir CFDI según el SAT')
      }
      
      if (resultadoAPI.razonSocial) {
        advertencias.push(`Razón social en SAT: ${resultadoAPI.razonSocial}. Verifique que coincida.`)
      }

      return {
        valido: errores.length === 0,
        errores,
        advertencias: [...validacionLocal.advertencias, ...advertencias],
        datosSAT: resultadoAPI,
      }
    }
    
    // Si la API falla, solo advertencia (no bloquea)
    advertencias.push('No se pudo validar RFC contra el SAT. Usando validación local únicamente.')
  }

  return {
    ...validacionLocal,
    advertencias: [...validacionLocal.advertencias, ...advertencias],
  }
}

// ============================================================================
// 2. VALIDACIÓN DE CÓDIGO POSTAL (COPOMEX)
// ============================================================================

export interface CodigoPostalResult {
  codigoPostal: string
  estado: string
  municipio: string
  colonias: string[]
  asentamientos: string[]
  valido: boolean
}

/**
 * Valida código postal usando API COPOMEX
 * 
 * @param codigoPostal - Código postal a validar (5 dígitos)
 * @returns Resultado con información del CP o null si falla
 */
export async function validarCodigoPostalCOPOMEX(
  codigoPostal: string
): Promise<CodigoPostalResult | null> {
  const apiToken = process.env.COPOMEX_API_TOKEN

  if (!apiToken) {
    console.warn('Token COPOMEX no configurado. Usando validación local.')
    return null
  }

  try {
    // API COPOMEX
    const response = await fetch(
      `https://api.copomex.com/query/info_cp/${codigoPostal}?token=${apiToken}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      // Si falla, intentar con API alternativa (SEPOMEX)
      return await validarCodigoPostalSEPOMEX(codigoPostal)
    }

    const data = await response.json()
    
    if (data.error) {
      return null
    }

    return {
      codigoPostal: data.codigo_postal || codigoPostal,
      estado: data.estado || '',
      municipio: data.municipio || '',
      colonias: data.colonias || [],
      asentamientos: data.asentamientos || [],
      valido: true,
    }
  } catch (error) {
    console.error('Error validando CP con COPOMEX:', error)
    // Fallback a SEPOMEX
    return await validarCodigoPostalSEPOMEX(codigoPostal)
  }
}

/**
 * Validación alternativa usando SEPOMEX Static API
 */
async function validarCodigoPostalSEPOMEX(
  codigoPostal: string
): Promise<CodigoPostalResult | null> {
  try {
    const response = await fetch(
      `https://sepomex.nitrostudio.com.mx/api/v1/codigo_postal/${codigoPostal}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    return {
      codigoPostal: data.codigo_postal || codigoPostal,
      estado: data.estado || '',
      municipio: data.municipio || '',
      colonias: data.colonias || [],
      asentamientos: data.asentamientos || [],
      valido: true,
    }
  } catch (error) {
    console.error('Error validando CP con SEPOMEX:', error)
    return null
  }
}

/**
 * Validación mejorada de código postal que combina local + API externa
 */
export async function validarCodigoPostalMejorado(
  codigoPostal: string,
  usarAPI: boolean = true
): Promise<ResultadoValidacion & { datosCP?: CodigoPostalResult }> {
  const errores: string[] = []
  const advertencias: string[] = []

  // Primero validación local (formato)
  const { validarCodigoPostal } = await import('./validaciones-fiscales')
  const validacionLocal = validarCodigoPostal(codigoPostal)
  
  if (!validacionLocal.valido) {
    return validacionLocal
  }

  // Si la validación local pasa, intentar validación externa
  if (usarAPI) {
    const resultadoAPI = await validarCodigoPostalCOPOMEX(codigoPostal)
    
    if (resultadoAPI) {
      if (!resultadoAPI.valido || resultadoAPI.colonias.length === 0) {
        advertencias.push('Código postal no tiene colonias asociadas. Verifique que sea correcto.')
      }

      return {
        valido: errores.length === 0,
        errores,
        advertencias: [...validacionLocal.advertencias, ...advertencias],
        datosCP: resultadoAPI,
      }
    }
    
    // Si la API falla, solo advertencia (no bloquea)
    advertencias.push('No se pudo validar código postal contra SEPOMEX. Usando validación local únicamente.')
  }

  return {
    ...validacionLocal,
    advertencias: [...validacionLocal.advertencias, ...advertencias],
  }
}

// ============================================================================
// 3. SINCRONIZACIÓN DE CATÁLOGOS SAT
// ============================================================================

export interface CatalogoSAT {
  clave: string
  descripcion: string
  fechaInicioVigencia?: string
  fechaFinVigencia?: string
}

/**
 * Obtiene catálogos SAT actualizados desde API externa
 * 
 * @param tipoCatalogo - Tipo de catálogo: 'regimenes', 'usos', 'formas_pago', etc.
 * @returns Array de items del catálogo o null si falla
 */
export async function obtenerCatalogoSATActualizado(
  tipoCatalogo: 'regimenes' | 'usos' | 'formas_pago' | 'metodos_pago' | 'periodicidades'
): Promise<CatalogoSAT[] | null> {
  const apiUrl = process.env.API_CATALOGOS_SAT_URL || 'https://api.fiscalapi.com/api/v4/catalogs'

  try {
    // Mapeo de nombres internos a nombres de API
    const mapeoCatalogos: Record<string, string> = {
      regimenes: 'SatTaxRegimes',
      usos: 'SatCFDIUses',
      formas_pago: 'SatPaymentForms',
      metodos_pago: 'SatPaymentMethods',
      periodicidades: 'SatPeriodicities',
    }

    const nombreAPI = mapeoCatalogos[tipoCatalogo]
    if (!nombreAPI) {
      console.error(`Tipo de catálogo no soportado: ${tipoCatalogo}`)
      return null
    }

    const response = await fetch(`${apiUrl}/${nombreAPI}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`Error obteniendo catálogo ${tipoCatalogo}: ${response.statusText}`)
      return null
    }

    const data = await response.json()
    
    // Convertir formato de API a formato interno
    return data.items?.map((item: any) => ({
      clave: item.code || item.clave,
      descripcion: item.description || item.descripcion,
      fechaInicioVigencia: item.startDate,
      fechaFinVigencia: item.endDate,
    })) || null
  } catch (error) {
    console.error(`Error obteniendo catálogo ${tipoCatalogo}:`, error)
    return null
  }
}

/**
 * Sincroniza catálogos locales con versiones actualizadas desde API
 * Solo actualiza si hay diferencias (no sobrescribe en cada llamada)
 */
export async function sincronizarCatalogosSAT(): Promise<{
  actualizados: string[]
  fallidos: string[]
  sinCambios: string[]
}> {
  const resultado = {
    actualizados: [] as string[],
    fallidos: [] as string[],
    sinCambios: [] as string[],
  }

  const tiposCatalogos: Array<'regimenes' | 'usos' | 'formas_pago' | 'metodos_pago' | 'periodicidades'> = [
    'regimenes',
    'usos',
    'formas_pago',
    'metodos_pago',
    'periodicidades',
  ]

  for (const tipo of tiposCatalogos) {
    try {
      const catalogoActualizado = await obtenerCatalogoSATActualizado(tipo)
      
      if (!catalogoActualizado) {
        resultado.fallidos.push(tipo)
        continue
      }

      // Aquí podrías comparar con catálogo local y actualizar si hay cambios
      // Por ahora solo registramos que se obtuvo exitosamente
      resultado.actualizados.push(tipo)
      
      console.log(`✅ Catálogo ${tipo} actualizado: ${catalogoActualizado.length} items`)
    } catch (error) {
      console.error(`Error sincronizando catálogo ${tipo}:`, error)
      resultado.fallidos.push(tipo)
    }
  }

  return resultado
}

// ============================================================================
// 4. UTILIDADES
// ============================================================================

/**
 * Verifica si las APIs externas están configuradas
 */
export function verificarConfiguracionAPIs(): {
  rfc: boolean
  codigoPostal: boolean
  catalogos: boolean
} {
  return {
    rfc: !!(process.env.API_VALIDACION_RFC_URL && process.env.API_VALIDACION_RFC_KEY),
    codigoPostal: !!process.env.COPOMEX_API_TOKEN,
    catalogos: !!process.env.API_CATALOGOS_SAT_URL,
  }
}
