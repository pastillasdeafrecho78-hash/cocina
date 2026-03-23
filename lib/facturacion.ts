import { obtenerConfiguracion } from './configuracion-restaurante'
import { prisma } from './prisma'
import { validarAntesDeTimbrar } from './validaciones-fiscales'
import fs from 'fs'
import path from 'path'

/**
 * Interfaz para datos del CFDI
 */
export interface CFDIData {
  comandaId: string
  receptor?: {
    rfc?: string
    nombre: string
    razonSocial?: string
    regimenFiscal?: string
    codigoPostal?: string
    usoCFDI?: string
    esPersonaMoral?: boolean
  }
  formaPago: string
  metodoPago: string
  esFacturaGlobal?: boolean
}

/**
 * Resultado del timbrado de CFDI
 */
export interface CFDIResult {
  uuid: string
  folio: string
  serie: string
  fechaEmision: Date
  xml: string
  pdf?: string
  qr: string
}

/**
 * Genera los datos del CFDI desde una comanda
 */
async function generarDatosCFDI(comandaId: string, receptor?: CFDIData['receptor'], esFacturaGlobal: boolean = false) {
  const comanda = await prisma.comanda.findUnique({
    where: { id: comandaId },
    include: {
      items: {
        include: {
          producto: {
            include: {
              categoria: true
            }
          },
          modificadores: {
            include: {
              modificador: true
            }
          }
        }
      },
      mesa: true,
      cliente: true,
    }
  })

  if (!comanda) {
    throw new Error('Comanda no encontrada')
  }

  const config = await obtenerConfiguracion(comanda.restauranteId)
  if (!config || !config.rfc) {
    throw new Error('Configuración fiscal no encontrada. Configure el restaurante primero.')
  }

  // Determinar datos del receptor
  let datosReceptor: {
    rfc: string
    nombre: string
    razonSocial?: string
    regimenFiscal?: string
    codigoPostal: string
    usoCFDI: string
    esPersonaMoral: boolean
  }

  if (esFacturaGlobal) {
    // Factura global: usar datos de configuración
    datosReceptor = {
      rfc: config.facturaGlobalRfcReceptor || 'XAXX010101000',
      nombre: config.facturaGlobalNombreReceptor || 'PÚBLICO EN GENERAL',
      regimenFiscal: config.facturaGlobalRegimenReceptor || '616',
      codigoPostal: config.lugarExpedicionCp || config.codigoPostal || '',
      usoCFDI: config.facturaGlobalUsoCFDI || 'S01',
      esPersonaMoral: false, // XAXX010101000 es genérico
    }
  } else if (receptor?.rfc && receptor?.nombre) {
    // Receptor proporcionado explícitamente
    datosReceptor = {
      rfc: receptor.rfc,
      nombre: receptor.nombre,
      razonSocial: receptor.razonSocial,
      regimenFiscal: receptor.regimenFiscal,
      codigoPostal: receptor.codigoPostal || '',
      usoCFDI: receptor.usoCFDI || 'G03',
      esPersonaMoral: receptor.esPersonaMoral || receptor.rfc.length === 12,
    }
  } else if (comanda.cliente?.rfc) {
    // Usar datos fiscales del cliente guardado
    datosReceptor = {
      rfc: comanda.cliente.rfc,
      nombre: comanda.cliente.razonSocial || comanda.cliente.nombre,
      razonSocial: comanda.cliente.razonSocial || undefined,
      regimenFiscal: comanda.cliente.regimenFiscal || undefined,
      codigoPostal: comanda.cliente.codigoPostal || '',
      usoCFDI: comanda.cliente.usoCFDI || 'G03',
      esPersonaMoral: comanda.cliente.rfc.length === 12,
    }
  } else {
    // Fallback: usar factura global si no hay datos del cliente
    datosReceptor = {
      rfc: config.facturaGlobalRfcReceptor || 'XAXX010101000',
      nombre: config.facturaGlobalNombreReceptor || 'PÚBLICO EN GENERAL',
      regimenFiscal: config.facturaGlobalRegimenReceptor || '616',
      codigoPostal: config.lugarExpedicionCp || config.codigoPostal || '',
      usoCFDI: config.facturaGlobalUsoCFDI || 'S01',
      esPersonaMoral: false,
    }
  }

  // Obtener configuración fiscal
  const preciosIncluyenIva = config.preciosIncluyenIva || false
  const tasaIva16 = config.tasaIva16 || 0.16
  const tasaIva0 = config.tasaIva0 || 0.0
  const tasaIeps = config.tasaIeps || 0.0
  const descuentosAntesImpuestos = config.descuentosAntesImpuestos !== false

  // Calcular subtotal de productos
  let subtotalProductos = comanda.items.reduce((sum, item) => sum + item.subtotal, 0)

  // Aplicar descuento según política
  let subtotalConDescuento = subtotalProductos
  if (comanda.descuento && comanda.descuento > 0) {
    if (descuentosAntesImpuestos) {
      subtotalConDescuento = subtotalProductos - comanda.descuento
    } else {
      subtotalConDescuento = subtotalProductos
    }
  }

  // Calcular IVA según política
  let iva = 0
  if (preciosIncluyenIva) {
    // Si precios incluyen IVA, extraer el IVA del subtotal
    iva = subtotalConDescuento * (tasaIva16 / (1 + tasaIva16))
    subtotalConDescuento = subtotalConDescuento - iva
  } else {
    // Si precios no incluyen IVA, sumar el IVA
    iva = subtotalConDescuento * tasaIva16
  }

  // Manejar propina según configuración
  let propinaEnCFDI = 0
  if (config.propinaFacturar && comanda.propina && comanda.propina > 0) {
    propinaEnCFDI = comanda.propina
  }

  // Calcular total
  let total = subtotalConDescuento + iva + propinaEnCFDI
  if (!descuentosAntesImpuestos && comanda.descuento) {
    total = total - comanda.descuento
  }

  // Generar conceptos con objetoImp e impuestos
  const conceptos = comanda.items.map(item => {
    // Obtener datos fiscales del producto
    const objetoImp = item.producto.objetoImp || '02' // Default: Sí objeto
    const claveProdServ = item.producto.claveProdServ || 
      (item.producto.categoria.tipo === 'COMIDA' ? '50201703' : 
       item.producto.categoria.tipo === 'BEBIDA' ? '50201705' : 
       '50171600')
    const claveUnidad = item.producto.claveUnidad || 'H87'

    // Calcular importe del concepto
    let importeConcepto = item.subtotal
    if (descuentosAntesImpuestos && comanda.descuento) {
      // Proporcional del descuento
      const proporcion = item.subtotal / subtotalProductos
      importeConcepto = item.subtotal - (comanda.descuento * proporcion)
    }

    // Calcular IVA del concepto según objetoImp
    let ivaConcepto = 0
    let ivaTasaConcepto = 0
    if (objetoImp === '02' && !preciosIncluyenIva) {
      // Sí objeto de impuesto: calcular IVA
      ivaTasaConcepto = tasaIva16
      ivaConcepto = importeConcepto * tasaIva16
    } else if (objetoImp === '02' && preciosIncluyenIva) {
      // Sí objeto pero precios incluyen IVA: extraer IVA
      ivaTasaConcepto = tasaIva16
      ivaConcepto = importeConcepto * (tasaIva16 / (1 + tasaIva16))
    }

    const descripcion = item.modificadores.length > 0
      ? `${item.cantidad}x ${item.producto.nombre} (${item.modificadores.map(m => m.modificador.nombre).join(', ')})`
      : `${item.cantidad}x ${item.producto.nombre}`

    return {
      claveProdServ,
      noIdentificacion: item.producto.id,
      cantidad: item.cantidad,
      claveUnidad,
      unidad: 'Pieza',
      descripcion,
      valorUnitario: item.precioUnitario,
      importe: importeConcepto,
      objetoImp,
      iva: ivaConcepto,
      ivaTasa: ivaTasaConcepto,
      impuestos: {
        traslados: objetoImp === '02' ? [{
          base: importeConcepto,
          impuesto: '002', // IVA
          tipoFactor: 'Tasa',
          tasaOCuota: ivaTasaConcepto.toFixed(6),
          importe: ivaConcepto
        }] : []
      }
    }
  })

  // Agregar propina como concepto si se factura
  if (propinaEnCFDI > 0) {
    const objetoImpPropina = config.propinaObjetoImp || '02'
    let ivaPropina = 0
    let ivaTasaPropina = 0

    if (objetoImpPropina === '02' && !preciosIncluyenIva) {
      ivaTasaPropina = tasaIva16
      ivaPropina = propinaEnCFDI * tasaIva16
    } else if (objetoImpPropina === '02' && preciosIncluyenIva) {
      ivaTasaPropina = tasaIva16
      ivaPropina = propinaEnCFDI * (tasaIva16 / (1 + tasaIva16))
    }

    conceptos.push({
      claveProdServ: '50171600', // Servicios de restaurantes
      noIdentificacion: 'PROPINA',
      cantidad: 1,
      claveUnidad: 'H87',
      unidad: 'Pieza',
      descripcion: 'Propina',
      valorUnitario: propinaEnCFDI,
      importe: propinaEnCFDI,
      objetoImp: objetoImpPropina,
      iva: ivaPropina,
      ivaTasa: ivaTasaPropina,
      impuestos: {
        traslados: objetoImpPropina === '02' ? [{
          base: propinaEnCFDI,
          impuesto: '002',
          tipoFactor: 'Tasa',
          tasaOCuota: ivaTasaPropina.toFixed(6),
          importe: ivaPropina
        }] : []
      }
    })
  }

  return {
    emisor: {
      rfc: config.rfc,
      nombre: config.nombre || '',
      regimenFiscal: config.regimenFiscal || '601',
      domicilioFiscal: {
        codigoPostal: config.codigoPostal || '',
        calle: config.calle || '',
        numeroExterior: config.numeroExterior || '',
        numeroInterior: config.numeroInterior || '',
        colonia: config.colonia || '',
        municipio: config.municipio || '',
        estado: config.estado || '',
        pais: config.pais || 'MEX'
      }
    },
    receptor: datosReceptor,
    conceptos,
    subtotal: subtotalConDescuento,
    iva: conceptos.reduce((sum, c) => sum + (c.iva || 0), 0),
    total,
    formaPago: '03',
    metodoPago: 'PUE',
    moneda: config.moneda || 'MXN',
    tipoComprobante: config.tipoComprobante || 'I',
    exportacion: config.exportacion || '01',
    lugarExpedicion: config.lugarExpedicionCp || config.codigoPostal || '',
  }
}

/**
 * Timbra un CFDI usando el PAC configurado
 */
export async function timbrarCFDI(data: CFDIData): Promise<CFDIResult & { conceptos: any[] }> {
  const comandaRef = await prisma.comanda.findUnique({
    where: { id: data.comandaId },
    select: { restauranteId: true },
  })
  if (!comandaRef) {
    throw new Error('Comanda no encontrada')
  }
  const config = await obtenerConfiguracion(comandaRef.restauranteId)

  if (!config || !config.pacApiKey) {
    throw new Error('PAC no configurado. Configure la facturación primero.')
  }

  const cfdiData = await generarDatosCFDI(data.comandaId, data.receptor, data.esFacturaGlobal)

  // VALIDACIONES FISCALES ANTES DE TIMBRAR
  const validacion = validarAntesDeTimbrar({
    receptor: {
      rfc: cfdiData.receptor.rfc,
      nombre: cfdiData.receptor.nombre,
      regimenFiscal: cfdiData.receptor.regimenFiscal,
      codigoPostal: cfdiData.receptor.codigoPostal,
      usoCFDI: cfdiData.receptor.usoCFDI,
      esPersonaMoral: cfdiData.receptor.esPersonaMoral,
    },
    metodoPago: data.metodoPago || cfdiData.metodoPago,
    formaPago: data.formaPago || cfdiData.formaPago,
    lugarExpedicionCP: cfdiData.lugarExpedicion,
    conceptos: cfdiData.conceptos.map(c => ({
      objetoImp: c.objetoImp,
      iva: c.iva,
      ivaTasa: c.ivaTasa,
    })),
  })

  // Si hay errores críticos, lanzar excepción
  if (!validacion.valido) {
    throw new Error(
      `Errores de validación fiscal:\n${validacion.errores.join('\n')}\n\n` +
      `Advertencias:\n${validacion.advertencias.join('\n')}`
    )
  }

  // Si hay advertencias, loguearlas (pero no bloquear)
  if (validacion.advertencias.length > 0) {
    console.warn('Advertencias fiscales:', validacion.advertencias)
  }

  // Obtener comanda para mapear productos
  const comanda = await prisma.comanda.findUnique({
    where: { id: data.comandaId },
    include: {
      items: {
        include: {
          producto: true
        }
      }
    }
  })

  // Generar conceptos para almacenamiento
  const conceptos = cfdiData.conceptos.map(c => {
    // Buscar el producto correspondiente
    const item = comanda?.items.find(i => i.producto.id === c.noIdentificacion)
    return {
      claveProdServ: c.claveProdServ,
      cantidad: c.cantidad,
      claveUnidad: c.claveUnidad,
      descripcion: c.descripcion,
      valorUnitario: c.valorUnitario,
      importe: c.importe,
      objetoImp: c.objetoImp,
      iva: c.iva || 0,
      ivaTasa: c.ivaTasa || 0,
      productoId: item?.productoId || (c.noIdentificacion === 'PROPINA' ? null : null),
    }
  })

  // Obtener serie y folio de configuración
  const serie = config.serieFactura || 'A'
  let folioActual = config.folioActual || config.folioInicial || 1

  // Incrementar folio actual
  await prisma.configuracionRestaurante.update({
    where: { restauranteId: comandaRef.restauranteId },
    data: {
      folioActual: folioActual + 1,
    },
  })

  const folio = folioActual.toString().padStart(8, '0')

  // TODO: Integrar con API del PAC (Facturación.com)
  // Por ahora retornamos estructura básica
  // En producción, aquí se haría la llamada al PAC
  
  const uuid = `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Generar XML básico (en producción se generaría completo según especificación CFDI 4.0)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0">
  <!-- XML completo del CFDI -->
</cfdi:Comprobante>`

  return {
    uuid,
    folio,
    serie,
    fechaEmision: new Date(),
    xml,
    qr: `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${config.rfc}&tt=${cfdiData.total}&fe=XXXXXX`,
    conceptos,
  }
}

/**
 * Almacena un CFDI timbrado en la base de datos
 */
export async function almacenarCFDI(
  comandaId: string,
  pagoId: string | null,
  cfdi: CFDIResult,
  conceptos: Array<{
    productoId?: string | null
    claveProdServ: string
    cantidad: number
    claveUnidad: string
    descripcion: string
    valorUnitario: number
    importe: number
    objetoImp: string
    iva: number
    ivaTasa?: number
  }>,
  detallesEmision?: Record<string, unknown>
) {
  const comanda = await prisma.comanda.findUnique({
    where: { id: comandaId },
    include: { cliente: true }
  })

  if (!comanda) {
    throw new Error('Comanda no encontrada')
  }

  const config = await obtenerConfiguracion(comanda.restauranteId)
  if (!config) {
    throw new Error('Configuración no encontrada')
  }

  // Determinar datos del receptor
  let receptorRfc: string | null = null
  let receptorNombre: string
  let usoCFDI: string

  if (comanda.cliente?.rfc) {
    receptorRfc = comanda.cliente.rfc
    receptorNombre = comanda.cliente.razonSocial || comanda.cliente.nombre
    usoCFDI = comanda.cliente.usoCFDI || 'G03'
  } else {
    // Factura global
    receptorRfc = config.facturaGlobalRfcReceptor || 'XAXX010101000'
    receptorNombre = config.facturaGlobalNombreReceptor || 'PÚBLICO EN GENERAL'
    usoCFDI = config.facturaGlobalUsoCFDI || 'S01'
  }

  // Calcular totales
  const subtotal = conceptos.reduce((sum, c) => sum + c.importe, 0)
  const iva = conceptos.reduce((sum, c) => sum + c.iva, 0)
  const total = subtotal + iva

  // Crear factura
  const factura = await prisma.factura.create({
    data: {
      comandaId,
      pagoId: pagoId || null,
      uuid: cfdi.uuid,
      folio: cfdi.folio,
      serie: cfdi.serie,
      fechaEmision: cfdi.fechaEmision,
      emisorRfc: config.rfc || '',
      receptorRfc,
      receptorNombre,
      usoCFDI,
      subtotal,
      iva,
      total,
      formaPago: '03', // TODO: usar del data
      metodoPago: 'PUE', // TODO: usar del data
      xml: cfdi.xml,
      pdf: cfdi.pdf || null,
      qrCode: cfdi.qr,
      ...(detallesEmision && { detallesEmision: detallesEmision as object }),
      conceptos: {
        create: conceptos.map(c => ({
          productoId: c.productoId || null,
          claveProdServ: c.claveProdServ,
          cantidad: c.cantidad,
          claveUnidad: c.claveUnidad,
          descripcion: c.descripcion,
          valorUnitario: c.valorUnitario,
          importe: c.importe,
          objetoImp: c.objetoImp,
          iva: c.iva,
          ivaTasa: c.ivaTasa || null,
        }))
      }
    }
  })

  return factura
}

/**
 * Cancela un CFDI
 */
export async function cancelarCFDI(
  facturaId: string,
  motivoCancelacion: string,
  uuidSustitucion?: string
) {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
  })

  if (!factura) {
    throw new Error('Factura no encontrada')
  }

  if (factura.estado === 'cancelada') {
    throw new Error('La factura ya está cancelada')
  }

  // Validar motivo
  if (motivoCancelacion === '01' && !uuidSustitucion) {
    throw new Error('El motivo 01 requiere UUID de sustitución')
  }

  // TODO: Llamar al PAC para cancelar
  // Por ahora solo actualizamos en BD

  const facturaActualizada = await prisma.factura.update({
    where: { id: facturaId },
    data: {
      estado: 'cancelada',
      motivoCancelacion,
      uuidSustitucion: uuidSustitucion || null,
      fechaCancelacion: new Date(),
    },
  })

  return facturaActualizada
}

/**
 * Genera el PDF de un CFDI
 */
export async function generarPDFCFDI(cfdi: CFDIResult): Promise<Buffer> {
  // TODO: Implementar generación de PDF usando PDFKit
  // Por ahora retornamos buffer vacío
  return Buffer.from('')
}
