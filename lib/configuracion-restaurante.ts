import { prisma } from '@/lib/prisma'
import * as crypto from 'crypto'

// Clave para encriptar datos sensibles (en producción usar variable de entorno)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const ALGORITHM = 'aes-256-cbc'

/**
 * Encripta un texto usando AES-256-CBC
 */
/** Reutilizable para IntegracionClip y otros secretos por tenant */
export function encryptSecret(text: string): string {
  return encrypt(text)
}

export function decryptSecret(encryptedText: string): string {
  return decrypt(encryptedText)
}

function encrypt(text: string): string {
  if (!text) return ''
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Desencripta un texto encriptado
 */
function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export interface DatosFiscales {
  rfc: string
  nombre: string
  regimenFiscal: string
  codigoPostal: string
  calle: string
  numeroExterior: string
  numeroInterior?: string
  colonia: string
  municipio: string
  estado: string
  pais?: string
}

export interface ConfiguracionPAC {
  apiKey: string
  apiUrl?: string
  modo: 'pruebas' | 'produccion'
}

export interface ConfiguracionConekta {
  privateKey: string
  publicKey: string
  apiVersion?: string
}

export interface ConfiguracionCSD {
  cerPath: string
  keyPath: string
  password: string
}

export interface LugarExpedicion {
  lugarExpedicionCp: string
  serieFactura: string
  folioInicial: number
}

export interface ConfiguracionComprobante {
  tipoComprobante: string
  exportacion: string
  moneda: string
  tipoCambio?: number
}

export interface ConfiguracionFiscal {
  preciosIncluyenIva: boolean
  tasaIva16: number
  tasaIva0: number
  tasaIeps: number
  descuentosAntesImpuestos: boolean
  redondeo: string
  propinaFacturar: boolean
  propinaObjetoImp: string
}

export interface ConfiguracionFacturaGlobal {
  habilitada: boolean
  rfcReceptor: string
  nombreReceptor: string
  regimenReceptor: string
  usoCFDI: string
  periodicidad: string
  mes?: number
  anio?: number
  politicaNominativa?: string
}

/**
 * Obtiene la configuración del restaurante (por tenant)
 */
export async function obtenerConfiguracion(restauranteId: string) {
  const config = await prisma.configuracionRestaurante.findUnique({
    where: { restauranteId },
  })
  if (!config) return null

  return {
    ...config,
    // Desencriptar datos sensibles
    pacApiKey: config.pacApiKey ? decrypt(config.pacApiKey) : null,
    conektaPrivateKey: config.conektaPrivateKey ? decrypt(config.conektaPrivateKey) : null,
    conektaPublicKey: config.conektaPublicKey ? decrypt(config.conektaPublicKey) : null,
    csdPassword: config.csdPassword ? decrypt(config.csdPassword) : null,
    webhookSecretConekta: config.webhookSecretConekta ? decrypt(config.webhookSecretConekta) : null,
  }
}

/**
 * Actualiza o crea la configuración del restaurante
 */
export async function guardarConfiguracion(
  restauranteId: string,
  data: {
  datosFiscales?: DatosFiscales
  lugarExpedicion?: LugarExpedicion
  configuracionComprobante?: ConfiguracionComprobante
  configuracionFiscal?: ConfiguracionFiscal
  pac?: ConfiguracionPAC
  conekta?: ConfiguracionConekta
  csd?: ConfiguracionCSD
  facturaGlobal?: ConfiguracionFacturaGlobal
  webhookSecretConekta?: string
  webhookUrl?: string
  configuradoPorId?: string
  tiempoAmarilloMinutos?: number
  tiempoRojoMinutos?: number
  alertaEfectivoMinimo?: number | null
}
) {
  const existing = await prisma.configuracionRestaurante.findUnique({
    where: { restauranteId },
  })

  const updateData: any = {
    updatedAt: new Date(),
  }

  // Datos fiscales
  if (data.datosFiscales) {
    updateData.rfc = data.datosFiscales.rfc
    updateData.nombre = data.datosFiscales.nombre
    updateData.regimenFiscal = data.datosFiscales.regimenFiscal
    updateData.codigoPostal = data.datosFiscales.codigoPostal
    updateData.calle = data.datosFiscales.calle
    updateData.numeroExterior = data.datosFiscales.numeroExterior
    updateData.numeroInterior = data.datosFiscales.numeroInterior || null
    updateData.colonia = data.datosFiscales.colonia
    updateData.municipio = data.datosFiscales.municipio
    updateData.estado = data.datosFiscales.estado
    updateData.pais = data.datosFiscales.pais || 'MEX'
  }

  // Lugar de expedición y Serie/Folio
  if (data.lugarExpedicion) {
    updateData.lugarExpedicionCp = data.lugarExpedicion.lugarExpedicionCp
    updateData.serieFactura = data.lugarExpedicion.serieFactura
    updateData.folioInicial = data.lugarExpedicion.folioInicial
    // Si es la primera vez, también establecer folioActual
    if (!existing?.folioActual) {
      updateData.folioActual = data.lugarExpedicion.folioInicial
    }
  }

  // Configuración del Comprobante
  if (data.configuracionComprobante) {
    updateData.tipoComprobante = data.configuracionComprobante.tipoComprobante
    updateData.exportacion = data.configuracionComprobante.exportacion
    updateData.moneda = data.configuracionComprobante.moneda
    updateData.tipoCambio = data.configuracionComprobante.tipoCambio || null
  }

  // Configuración Fiscal Operativa
  if (data.configuracionFiscal) {
    updateData.preciosIncluyenIva = data.configuracionFiscal.preciosIncluyenIva
    updateData.tasaIva16 = data.configuracionFiscal.tasaIva16
    updateData.tasaIva0 = data.configuracionFiscal.tasaIva0
    updateData.tasaIeps = data.configuracionFiscal.tasaIeps
    updateData.descuentosAntesImpuestos = data.configuracionFiscal.descuentosAntesImpuestos
    updateData.redondeo = data.configuracionFiscal.redondeo
    updateData.propinaFacturar = data.configuracionFiscal.propinaFacturar
    updateData.propinaObjetoImp = data.configuracionFiscal.propinaObjetoImp
  }

  // Configuración PAC
  if (data.pac) {
    updateData.pacApiKey = encrypt(data.pac.apiKey)
    updateData.pacApiUrl = data.pac.apiUrl || 'https://api.facturacion.com/v1'
    updateData.pacModo = data.pac.modo
    updateData.pacConfigurado = true
  }

  // Configuración Conekta
  if (data.conekta) {
    updateData.conektaPrivateKey = encrypt(data.conekta.privateKey)
    updateData.conektaPublicKey = encrypt(data.conekta.publicKey)
    updateData.conektaApiVersion = data.conekta.apiVersion || '2.0'
    updateData.pagosConfigurado = true
  }

  // Configuración CSD
  if (data.csd) {
    updateData.csdCerPath = data.csd.cerPath
    updateData.csdKeyPath = data.csd.keyPath
    updateData.csdPassword = encrypt(data.csd.password)
    updateData.csdVigente = true
  }

  // Factura Global
  if (data.facturaGlobal) {
    updateData.facturaGlobalHabilitada = data.facturaGlobal.habilitada
    updateData.facturaGlobalRfcReceptor = data.facturaGlobal.rfcReceptor
    updateData.facturaGlobalNombreReceptor = data.facturaGlobal.nombreReceptor
    updateData.facturaGlobalRegimenReceptor = data.facturaGlobal.regimenReceptor
    updateData.facturaGlobalUsoCFDI = data.facturaGlobal.usoCFDI
    updateData.facturaGlobalPeriodicidad = data.facturaGlobal.periodicidad
    updateData.facturaGlobalMes = data.facturaGlobal.mes || null
    updateData.facturaGlobalAnio = data.facturaGlobal.anio || null
    updateData.facturaGlobalPoliticaNominativa = data.facturaGlobal.politicaNominativa || 'emitir_sin_ajustar'
  }

  // Webhooks
  if (data.webhookSecretConekta) {
    updateData.webhookSecretConekta = encrypt(data.webhookSecretConekta)
  }
  if (data.webhookUrl) {
    updateData.webhookUrl = data.webhookUrl
  }

  // Configuración de tiempos para mesas
  if (data.tiempoAmarilloMinutos !== undefined) {
    updateData.tiempoAmarilloMinutos = data.tiempoAmarilloMinutos
  }
  if (data.tiempoRojoMinutos !== undefined) {
    updateData.tiempoRojoMinutos = data.tiempoRojoMinutos
  }
  if (data.alertaEfectivoMinimo !== undefined) {
    updateData.alertaEfectivoMinimo = data.alertaEfectivoMinimo
  }

  // Verificar si la configuración está completa
  const configCompleta = 
    updateData.rfc &&
    updateData.pacApiKey &&
    updateData.conektaPrivateKey &&
    updateData.csdCerPath &&
    updateData.lugarExpedicionCp &&
    updateData.serieFactura

  if (configCompleta) {
    updateData.configuracionCompleta = true
    updateData.fechaConfiguracion = new Date()
    if (data.configuradoPorId) {
      updateData.configuradoPorId = data.configuradoPorId
    }
  }

  if (existing) {
    return await prisma.configuracionRestaurante.update({
      where: { id: existing.id },
      data: updateData,
    })
  } else {
    return await prisma.configuracionRestaurante.create({
      data: {
        restauranteId,
        ...updateData,
        configuracionCompleta: false,
      },
    })
  }
}

/**
 * Verifica si la configuración está completa
 */
export async function verificarConfiguracionCompleta(
  restauranteId: string
): Promise<boolean> {
  const config = await prisma.configuracionRestaurante.findUnique({
    where: { restauranteId },
  })
  return config?.configuracionCompleta || false
}
