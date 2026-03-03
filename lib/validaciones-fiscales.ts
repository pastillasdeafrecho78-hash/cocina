/**
 * Validaciones Fiscales CFDI 4.0
 * Reglas de validación previas al timbrado para evitar rechazos del SAT
 */

import { REGIMENES_FISCALES, USOS_CFDI } from './catalogos-sat'

export interface ResultadoValidacion {
  valido: boolean
  errores: string[]
  advertencias: string[]
}

/**
 * Valida formato de RFC
 * Persona física: 13 caracteres (4 letras + 6 dígitos + 3 alfanuméricos)
 * Persona moral: 12 caracteres (3 letras + 6 dígitos + 3 alfanuméricos)
 */
export function validarRFC(rfc: string, esPersonaMoral: boolean = false): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  if (!rfc || rfc.trim() === '') {
    errores.push('RFC es requerido')
    return { valido: false, errores, advertencias }
  }

  const rfcLimpio = rfc.trim().toUpperCase()
  const longitudEsperada = esPersonaMoral ? 12 : 13

  if (rfcLimpio.length !== longitudEsperada) {
    errores.push(`RFC debe tener ${longitudEsperada} caracteres para ${esPersonaMoral ? 'persona moral' : 'persona física'}`)
  }

  // Validar formato básico
  const patronFisica = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/
  const patronMoral = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/
  const patron = esPersonaMoral ? patronMoral : patronFisica

  if (!patron.test(rfcLimpio)) {
    errores.push(`RFC con formato inválido. Formato esperado: ${esPersonaMoral ? 'ABC123456789' : 'ABCD123456789'}`)
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  }
}

/**
 * Valida que el nombre/razón social no esté vacío y tenga formato razonable
 */
export function validarNombreReceptor(nombre: string): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  if (!nombre || nombre.trim() === '') {
    errores.push('Nombre o razón social del receptor es requerido')
    return { valido: false, errores, advertencias }
  }

  const nombreLimpio = nombre.trim()

  if (nombreLimpio.length < 3) {
    errores.push('Nombre o razón social debe tener al menos 3 caracteres')
  }

  if (nombreLimpio.length > 300) {
    advertencias.push('Nombre muy largo, verifique que sea correcto')
  }

  // Advertencia si tiene caracteres especiales que puedan causar problemas
  if (/[<>"&]/.test(nombreLimpio)) {
    advertencias.push('El nombre contiene caracteres especiales que pueden causar problemas en el XML')
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  }
}

/**
 * Valida código postal (5 dígitos en México)
 */
export function validarCodigoPostal(cp: string): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  if (!cp || cp.trim() === '') {
    errores.push('Código postal es requerido')
    return { valido: false, errores, advertencias }
  }

  const cpLimpio = cp.trim()

  if (!/^\d{5}$/.test(cpLimpio)) {
    errores.push('Código postal debe tener exactamente 5 dígitos')
  }

  // Validar rango válido en México (01000-99999)
  const cpNum = parseInt(cpLimpio, 10)
  if (cpNum < 1000 || cpNum > 99999) {
    advertencias.push('Código postal fuera del rango típico de México (01000-99999)')
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  }
}

/**
 * Tabla de compatibilidad Régimen Fiscal ↔ Uso CFDI
 * Basado en reglas comunes del SAT (puede variar según interpretación)
 */
const COMPATIBILIDAD_REGIMEN_USO: Record<string, string[]> = {
  // Régimen 601 - General de Ley Personas Morales
  '601': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'P01', 'CP01', 'CN01'],
  
  // Régimen 603 - Personas Físicas con Actividades Empresariales
  '603': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'P01', 'S01'],
  
  // Régimen 605 - Sueldos y Salarios
  '605': ['G01', 'G02', 'G03', 'P01', 'S01'],
  
  // Régimen 616 - Sin obligaciones fiscales (público en general)
  '616': ['S01', 'P01'],
  
  // Régimen 621 - Incorporación Fiscal (RIF)
  '621': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'P01', 'S01'],
  
  // Régimen 626 - Régimen Simplificado de Confianza
  '626': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'P01', 'S01'],
}

/**
 * Valida compatibilidad entre Régimen Fiscal y Uso CFDI
 */
export function validarCompatibilidadRegimenUsoCFDI(
  regimenFiscal: string,
  usoCFDI: string
): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  if (!regimenFiscal || !usoCFDI) {
    errores.push('Régimen fiscal y Uso CFDI son requeridos')
    return { valido: false, errores, advertencias }
  }

  const usosPermitidos = COMPATIBILIDAD_REGIMEN_USO[regimenFiscal]

  if (!usosPermitidos) {
    advertencias.push(`Régimen fiscal ${regimenFiscal} no está en la tabla de compatibilidad. Se recomienda validar con el SAT.`)
    return { valido: true, errores, advertencias } // No bloqueamos si no está en la tabla
  }

  if (!usosPermitidos.includes(usoCFDI)) {
    errores.push(
      `El Uso CFDI "${usoCFDI}" no es compatible con el Régimen Fiscal "${regimenFiscal}". ` +
      `Usos permitidos: ${usosPermitidos.join(', ')}`
    )
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  }
}

/**
 * Valida coherencia entre Método de Pago y Forma de Pago
 */
export function validarMetodoFormaPago(
  metodoPago: string,
  formaPago: string
): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  if (!metodoPago || !formaPago) {
    errores.push('Método de pago y Forma de pago son requeridos')
    return { valido: false, errores, advertencias }
  }

  // Regla: Si MétodoPago = PUE, FormaPago no debe ser "99" (por definir)
  if (metodoPago === 'PUE' && formaPago === '99') {
    errores.push(
      'Si el Método de Pago es PUE (Pago en una exhibición), ' +
      'la Forma de Pago no puede ser "99 - Por definir". ' +
      'Debe especificar la forma de pago real (01=Efectivo, 03=Transferencia, 04=Tarjeta, etc.)'
    )
  }

  // Advertencia: Si MétodoPago = PPD, FormaPago puede ser "99" pero se recomienda especificar
  if (metodoPago === 'PPD' && formaPago === '99') {
    advertencias.push(
      'Con Método de Pago PPD, se recomienda especificar la Forma de Pago real. ' +
      'El pago detallado se registrará en el Complemento de Pago.'
    )
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  }
}

/**
 * Valida que el CP del receptor coincida con el lugar de expedición (para factura global)
 */
export function validarCPReceptorGlobal(
  cpReceptor: string,
  lugarExpedicionCP: string
): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  if (!cpReceptor || !lugarExpedicionCP) {
    return { valido: true, errores, advertencias } // No aplica si no hay datos
  }

  if (cpReceptor !== lugarExpedicionCP) {
    advertencias.push(
      `El CP del receptor (${cpReceptor}) no coincide con el lugar de expedición (${lugarExpedicionCP}). ` +
      'Para factura global, el CP del receptor debe ser el mismo que el lugar de expedición.'
    )
  }

  return {
    valido: true, // No es error crítico, solo advertencia
    errores,
    advertencias,
  }
}

/**
 * Validación completa de datos del receptor antes de timbrar
 */
export function validarDatosReceptor(data: {
  rfc: string
  nombre: string
  regimenFiscal?: string
  codigoPostal: string
  usoCFDI: string
  esPersonaMoral?: boolean
  lugarExpedicionCP?: string
}): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  // Validar RFC
  const validacionRFC = validarRFC(data.rfc, data.esPersonaMoral)
  errores.push(...validacionRFC.errores)
  advertencias.push(...validacionRFC.advertencias)

  // Validar nombre
  const validacionNombre = validarNombreReceptor(data.nombre)
  errores.push(...validacionNombre.errores)
  advertencias.push(...validacionNombre.advertencias)

  // Validar CP
  const validacionCP = validarCodigoPostal(data.codigoPostal)
  errores.push(...validacionCP.errores)
  advertencias.push(...validacionCP.advertencias)

  // Validar compatibilidad Régimen ↔ Uso CFDI
  if (data.regimenFiscal) {
    const validacionCompatibilidad = validarCompatibilidadRegimenUsoCFDI(
      data.regimenFiscal,
      data.usoCFDI
    )
    errores.push(...validacionCompatibilidad.errores)
    advertencias.push(...validacionCompatibilidad.advertencias)
  }

  // Validar CP receptor vs lugar expedición (si es global)
  if (data.lugarExpedicionCP) {
    const validacionCPGlobal = validarCPReceptorGlobal(
      data.codigoPostal,
      data.lugarExpedicionCP
    )
    advertencias.push(...validacionCPGlobal.advertencias)
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  }
}

/**
 * Validación completa antes de timbrar CFDI
 */
export function validarAntesDeTimbrar(data: {
  receptor: {
    rfc: string
    nombre: string
    regimenFiscal?: string
    codigoPostal: string
    usoCFDI: string
    esPersonaMoral?: boolean
  }
  metodoPago: string
  formaPago: string
  lugarExpedicionCP?: string
  conceptos: Array<{
    objetoImp: string
    iva?: number
    ivaTasa?: number
  }>
}): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  // Validar receptor
  const validacionReceptor = validarDatosReceptor({
    ...data.receptor,
    lugarExpedicionCP: data.lugarExpedicionCP,
  })
  errores.push(...validacionReceptor.errores)
  advertencias.push(...validacionReceptor.advertencias)

  // Validar método/forma de pago
  const validacionPago = validarMetodoFormaPago(data.metodoPago, data.formaPago)
  errores.push(...validacionPago.errores)
  advertencias.push(...validacionPago.advertencias)

  // Validar conceptos
  data.conceptos.forEach((concepto, index) => {
    // Si objetoImp es "01" (no objeto), no debe tener IVA
    if (concepto.objetoImp === '01' && (concepto.iva || 0) > 0) {
      errores.push(
        `Concepto ${index + 1}: Si ObjetoImp es "01" (No objeto de impuesto), no debe tener IVA`
      )
    }

    // Si objetoImp es "02" (sí objeto), debe tener IVA o tasa definida
    if (concepto.objetoImp === '02' && !concepto.ivaTasa && (concepto.iva || 0) === 0) {
      advertencias.push(
        `Concepto ${index + 1}: ObjetoImp es "02" pero no tiene IVA. Verifique si es correcto.`
      )
    }
  })

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  }
}
