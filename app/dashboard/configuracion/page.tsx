'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/auth-fetch'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import BackButton from '@/components/BackButton'
import {
  REGIMENES_FISCALES,
  USOS_CFDI,
  CLAVES_PROD_SERV,
  CLAVES_UNIDAD,
  FORMAS_PAGO,
  METODOS_PAGO,
  PERIODICIDADES,
  TIPOS_COMPROBANTE,
  EXPORTACION,
  MONEDAS,
  OBJETOS_IMP,
} from '@/lib/catalogos-sat'

const MODO_CONFIG_KEY = 'configuracion_modo_facil'

interface ConfiguracionData {
  // Paso 1: Datos Fiscales Obligatorios
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
  pais: string

  // Paso 2: Lugar de Expedición y Serie/Folio
  lugarExpedicionCp: string
  serieFactura: string
  folioInicial: number

  // Paso 3: Configuración del Comprobante
  tipoComprobante: string
  exportacion: string
  moneda: string
  tipoCambio?: number

  // Paso 4: Configuración Fiscal Operativa
  preciosIncluyenIva: boolean
  tasaIva16: number
  tasaIva0: number
  tasaIeps: number
  descuentosAntesImpuestos: boolean
  redondeo: string
  propinaFacturar: boolean
  propinaObjetoImp: string

  // Paso 5: PAC
  pacApiKey: string
  pacModo: 'pruebas' | 'produccion'

  // Paso 6: CSD
  csdCerPath: string
  csdKeyPath: string
  csdPassword: string

  // Paso 7: Factura Global
  facturaGlobalHabilitada: boolean
  facturaGlobalRfcReceptor: string
  facturaGlobalNombreReceptor: string
  facturaGlobalRegimenReceptor: string
  facturaGlobalUsoCFDI: string
  facturaGlobalPeriodicidad: string
  facturaGlobalMes?: number
  facturaGlobalAnio?: number
  facturaGlobalPoliticaNominativa: string

  // Paso 8: Conekta
  conektaPrivateKey: string
  conektaPublicKey: string

  // Paso 9: Tiempos de Mesas
  tiempoAmarilloMinutos?: number
  tiempoRojoMinutos?: number
}

const TOTAL_PASOS = 9
const TOTAL_PASOS_FACIL = 3

export default function ConfiguracionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [paso, setPaso] = useState(1)
  const [configExistente, setConfigExistente] = useState<any>(null)
  const [modoFacil, setModoFacil] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem(MODO_CONFIG_KEY)
      return v !== 'false'
    } catch {
      return true
    }
  })

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<ConfiguracionData>({
    defaultValues: {
      pais: 'MEX',
      regimenFiscal: '601',
      pacModo: 'pruebas',
      lugarExpedicionCp: '',
      serieFactura: 'A',
      folioInicial: 1,
      tipoComprobante: 'I',
      exportacion: '01',
      moneda: 'MXN',
      preciosIncluyenIva: false,
      tasaIva16: 0.16,
      tasaIva0: 0.0,
      tasaIeps: 0.0,
      descuentosAntesImpuestos: true,
      redondeo: 'redondeo',
      propinaFacturar: false,
      propinaObjetoImp: '02',
      facturaGlobalHabilitada: true,
      facturaGlobalRfcReceptor: 'XAXX010101000',
      facturaGlobalNombreReceptor: 'PÚBLICO EN GENERAL',
      facturaGlobalRegimenReceptor: '616',
      facturaGlobalUsoCFDI: 'S01',
      facturaGlobalPeriodicidad: '04',
      facturaGlobalPoliticaNominativa: 'emitir_sin_ajustar',
      tiempoAmarilloMinutos: 30,
      tiempoRojoMinutos: 60,
    }
  })

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(MODO_CONFIG_KEY, String(modoFacil))
    } catch {}
  }, [modoFacil])

  const handleToggleModo = (facil: boolean) => {
    setModoFacil(facil)
    setPaso(1)
  }

  const cargarConfiguracion = async () => {
    try {
      const response = await apiFetch('/api/configuracion', {
        headers: {
                  },
      })

      const data = await response.json()
      if (data.success && data.data) {
        setConfigExistente(data.data)
        // Pre-llenar formulario con datos existentes
        Object.keys(data.data).forEach(key => {
          if (data.data[key] !== null && data.data[key] !== undefined) {
            setValue(key as keyof ConfiguracionData, data.data[key])
          }
        })
      }
    } catch (error) {
      console.error('Error cargando configuración:', error)
    }
  }

  const totalPasos = modoFacil ? TOTAL_PASOS_FACIL : TOTAL_PASOS

  const onSubmit = async (data: ConfiguracionData) => {
    setLoading(true)
    try {
      const payload: any = {}

      if (modoFacil) {
        if (paso === 1) {
          payload.datosFiscales = {
            rfc: data.rfc,
            nombre: data.nombre,
            regimenFiscal: data.regimenFiscal,
            codigoPostal: data.codigoPostal,
            calle: data.calle,
            numeroExterior: data.numeroExterior,
            numeroInterior: data.numeroInterior,
            colonia: data.colonia,
            municipio: data.municipio,
            estado: data.estado,
            pais: data.pais,
          }
          payload.lugarExpedicion = {
            lugarExpedicionCp: data.lugarExpedicionCp,
            serieFactura: data.serieFactura,
            folioInicial: data.folioInicial,
          }
        } else if (paso === 2) {
          payload.configuracionComprobante = {
            tipoComprobante: 'I',
            exportacion: '01',
            moneda: 'MXN',
            tipoCambio: undefined,
          }
          payload.configuracionFiscal = {
            preciosIncluyenIva: false,
            tasaIva16: 0.16,
            tasaIva0: 0,
            tasaIeps: 0,
            descuentosAntesImpuestos: true,
            redondeo: 'redondeo',
            propinaFacturar: data.propinaFacturar,
            propinaObjetoImp: data.propinaObjetoImp || '02',
          }
          payload.facturaGlobal = {
            habilitada: data.facturaGlobalHabilitada,
            rfcReceptor: data.facturaGlobalRfcReceptor ?? 'XAXX010101000',
            nombreReceptor: data.facturaGlobalNombreReceptor ?? 'PÚBLICO EN GENERAL',
            regimenReceptor: data.facturaGlobalRegimenReceptor ?? '616',
            usoCFDI: data.facturaGlobalUsoCFDI ?? 'S01',
            periodicidad: data.facturaGlobalPeriodicidad ?? '04',
            mes: data.facturaGlobalMes,
            anio: data.facturaGlobalAnio,
            politicaNominativa: data.facturaGlobalPoliticaNominativa ?? 'emitir_sin_ajustar',
          }
        } else if (paso === 3) {
          payload.pac = { apiKey: data.pacApiKey, modo: data.pacModo }
          payload.csd = {
            cerPath: data.csdCerPath,
            keyPath: data.csdKeyPath,
            password: data.csdPassword,
          }
          payload.conekta = {
            privateKey: data.conektaPrivateKey,
            publicKey: data.conektaPublicKey,
          }
          payload.tiempos = {
            tiempoAmarilloMinutos: data.tiempoAmarilloMinutos ?? 30,
            tiempoRojoMinutos: data.tiempoRojoMinutos ?? 60,
          }
        }
      } else {
        if (paso === 1) {
          payload.datosFiscales = {
            rfc: data.rfc,
            nombre: data.nombre,
            regimenFiscal: data.regimenFiscal,
            codigoPostal: data.codigoPostal,
            calle: data.calle,
            numeroExterior: data.numeroExterior,
            numeroInterior: data.numeroInterior,
            colonia: data.colonia,
            municipio: data.municipio,
            estado: data.estado,
            pais: data.pais,
          }
        } else if (paso === 2) {
          payload.lugarExpedicion = {
            lugarExpedicionCp: data.lugarExpedicionCp,
            serieFactura: data.serieFactura,
            folioInicial: data.folioInicial,
          }
        } else if (paso === 3) {
          payload.configuracionComprobante = {
            tipoComprobante: data.tipoComprobante,
            exportacion: data.exportacion,
            moneda: data.moneda,
            tipoCambio: data.tipoCambio,
          }
        } else if (paso === 4) {
          payload.configuracionFiscal = {
            preciosIncluyenIva: data.preciosIncluyenIva,
            tasaIva16: data.tasaIva16,
            tasaIva0: data.tasaIva0,
            tasaIeps: data.tasaIeps,
            descuentosAntesImpuestos: data.descuentosAntesImpuestos,
            redondeo: data.redondeo,
            propinaFacturar: data.propinaFacturar,
            propinaObjetoImp: data.propinaObjetoImp,
          }
        } else if (paso === 5) {
          payload.pac = { apiKey: data.pacApiKey, modo: data.pacModo }
        } else if (paso === 6) {
          payload.csd = {
            cerPath: data.csdCerPath,
            keyPath: data.csdKeyPath,
            password: data.csdPassword,
          }
        } else if (paso === 7) {
          payload.facturaGlobal = {
            habilitada: data.facturaGlobalHabilitada,
            rfcReceptor: data.facturaGlobalRfcReceptor,
            nombreReceptor: data.facturaGlobalNombreReceptor,
            regimenReceptor: data.facturaGlobalRegimenReceptor,
            usoCFDI: data.facturaGlobalUsoCFDI,
            periodicidad: data.facturaGlobalPeriodicidad,
            mes: data.facturaGlobalMes,
            anio: data.facturaGlobalAnio,
            politicaNominativa: data.facturaGlobalPoliticaNominativa,
          }
        } else if (paso === 8) {
          payload.conekta = {
            privateKey: data.conektaPrivateKey,
            publicKey: data.conektaPublicKey,
          }
        } else if (paso === 9) {
          payload.tiempos = {
            tiempoAmarilloMinutos: data.tiempoAmarilloMinutos,
            tiempoRojoMinutos: data.tiempoRojoMinutos,
          }
        }
      }

      const response = await apiFetch('/api/configuracion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
                  },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Configuración guardada correctamente')
        if (paso < totalPasos) {
          siguientePaso()
        } else {
          router.push('/dashboard')
        }
      } else {
        toast.error(result.error || 'Error al guardar configuración')
      }
    } catch (error: any) {
      toast.error('Error al guardar configuración')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const siguientePaso = () => {
    if (paso < totalPasos) {
      setPaso(paso + 1)
    }
  }

  const pasoAnterior = () => {
    if (paso > 1) {
      setPaso(paso - 1)
    }
  }

  const nombresPasos = [
    'Datos Fiscales',
    'Lugar Expedición',
    'Comprobante',
    'Fiscal Operativa',
    'PAC',
    'CSD',
    'Factura Global',
    'Pagos',
    'Tiempos',
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 text-black">
      <div className="max-w-4xl mx-auto">
        <BackButton className="mb-4" />
        <div className="bg-white shadow-md rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Configuración Inicial de Facturación del Restaurante (EMISOR)
          </h1>
          <p className="text-gray-600 mb-4">
            Complete la configuración para habilitar facturación CFDI 4.0 válidos, individuales y globales, sin rechazos del SAT
          </p>

          {/* Toggle Fácil / Avanzado */}
          <div className="flex items-center justify-between mb-6 p-3 bg-gray-100 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Modo</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              <button
                type="button"
                onClick={() => handleToggleModo(true)}
                className={`px-4 py-2 text-sm font-medium ${
                  modoFacil
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Fácil
              </button>
              <button
                type="button"
                onClick={() => handleToggleModo(false)}
                className={`px-4 py-2 text-sm font-medium ${
                  !modoFacil
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Avanzado
              </button>
            </div>
            <p className="text-xs text-gray-500 max-w-[200px]">
              {modoFacil
                ? 'Pocas decisiones, resto por defecto.'
                : 'Configuración completa (contador/admin).'}
            </p>
          </div>

          {/* Indicador de pasos */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {Array.from({ length: modoFacil ? TOTAL_PASOS_FACIL : TOTAL_PASOS }, (_, i) => i + 1).map((num) => (
                <div key={num} className="flex items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                      paso >= num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {num}
                  </div>
                  {num < (modoFacil ? TOTAL_PASOS_FACIL : TOTAL_PASOS) && (
                    <div
                      className={`flex-1 h-1 mx-1 ${
                        paso > num ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              {(modoFacil
                ? ['Datos + Lugar', 'Decisiones', 'PAC y más']
                : nombresPasos
              ).map((nombre, idx) => (
                <span key={idx} className="text-center flex-1 truncate px-1">
                  {nombre}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Paso 1: Datos Fiscales Obligatorios */}
            {paso === 1 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">1. Datos fiscales obligatorios del restaurante</h3>
                  <p className="text-sm text-blue-800">
                    Capturar y validar los datos fiscales exactos como aparecen en el SAT. Estos datos son obligatorios para emitir CFDI válidos.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RFC del Emisor *
                    </label>
                    <input
                      {...register('rfc', { 
                        required: 'RFC es requerido',
                        pattern: {
                          value: /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
                          message: 'RFC inválido'
                        }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="ABC123456789"
                    />
                    {errors.rfc && (
                      <p className="text-red-600 text-sm mt-1">{errors.rfc.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Régimen Fiscal *
                    </label>
                    <select
                      {...register('regimenFiscal', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      {REGIMENES_FISCALES.map(reg => (
                        <option key={reg.clave} value={reg.clave}>
                          {reg.clave} - {reg.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre o Razón Social (exacto como SAT) *
                    </label>
                    <input
                      {...register('nombre', { required: 'Nombre es requerido' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="RESTAURANTE EJEMPLO S.A. DE C.V."
                    />
                    {errors.nombre && (
                      <p className="text-red-600 text-sm mt-1">{errors.nombre.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código Postal *
                    </label>
                    <input
                      {...register('codigoPostal', { required: true, pattern: /^\d{5}$/ })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="01000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Calle *
                    </label>
                    <input
                      {...register('calle', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="Av. Ejemplo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número Exterior *
                    </label>
                    <input
                      {...register('numeroExterior', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número Interior
                    </label>
                    <input
                      {...register('numeroInterior')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="A"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Colonia *
                    </label>
                    <input
                      {...register('colonia', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="Colonia Ejemplo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Municipio *
                    </label>
                    <input
                      {...register('municipio', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="Ciudad de México"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado *
                    </label>
                    <input
                      {...register('estado', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="Ciudad de México"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      País
                    </label>
                    <input
                      {...register('pais')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      defaultValue="MEX"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Paso 2: Lugar de Expedición y Serie/Folio (Avanzado) o mismo en Fácil paso 1 */}
            {((!modoFacil && paso === 2) || (modoFacil && paso === 1)) && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    {modoFacil ? 'Lugar de expedición y Serie/Folio' : '2. Lugar de expedición y Serie/Folio'}
                  </h3>
                  <p className="text-sm text-blue-800">
                    El lugar de expedición es el código postal del establecimiento que emite la factura. Puede variar por sucursal o caja.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código Postal del Lugar de Expedición *
                    </label>
                    <input
                      {...register('lugarExpedicionCp', { 
                        required: 'Código postal es requerido',
                        pattern: /^\d{5}$/
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="01000"
                    />
                    {errors.lugarExpedicionCp && (
                      <p className="text-red-600 text-sm mt-1">{errors.lugarExpedicionCp.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Código postal del establecimiento que emite la factura (puede ser diferente al domicilio fiscal)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Serie de Factura *
                    </label>
                    <input
                      {...register('serieFactura', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="A, POS, R1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Serie para identificar facturas (ej. POS, A, R1)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Folio Inicial *
                    </label>
                    <input
                      {...register('folioInicial', { 
                        required: true,
                        valueAsNumber: true,
                        min: { value: 1, message: 'Debe ser mayor a 0' }
                      })}
                      type="number"
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="1"
                    />
                    {errors.folioInicial && (
                      <p className="text-red-600 text-sm mt-1">{errors.folioInicial.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Folio consecutivo inicial. Se incrementará automáticamente con cada factura.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 3: Configuración del Comprobante (solo Avanzado) */}
            {!modoFacil && paso === 3 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">3. Configuración del comprobante</h3>
                  <p className="text-sm text-blue-800">
                    Defina los valores por defecto para los comprobantes fiscales.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Comprobante *
                    </label>
                    <select
                      {...register('tipoComprobante', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      {TIPOS_COMPROBANTE.map(tipo => (
                        <option key={tipo.clave} value={tipo.clave}>
                          {tipo.clave} - {tipo.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exportación *
                    </label>
                    <select
                      {...register('exportacion', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      {EXPORTACION.map(exp => (
                        <option key={exp.clave} value={exp.clave}>
                          {exp.clave} - {exp.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Moneda *
                    </label>
                    <select
                      {...register('moneda', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      {MONEDAS.map(mon => (
                        <option key={mon.clave} value={mon.clave}>
                          {mon.clave} - {mon.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Cambio
                    </label>
                    <input
                      {...register('tipoCambio', { 
                        valueAsNumber: true,
                        min: { value: 0.01, message: 'Debe ser mayor a 0' }
                      })}
                      type="number"
                      step="0.0001"
                      min="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="1.0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Solo requerido si se usa otra moneda diferente a MXN
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 4: Configuración Fiscal Operativa (solo Avanzado) */}
            {!modoFacil && paso === 4 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">4. Configuración fiscal operativa del restaurante</h3>
                  <p className="text-sm text-blue-800">
                    Defina las reglas internas para el cálculo de impuestos y precios.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      {...register('preciosIncluyenIva')}
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm font-medium text-gray-700">
                      Los precios incluyen IVA (si no está marcado, el IVA se suma)
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tasa IVA 16% *
                      </label>
                      <input
                        {...register('tasaIva16', { 
                          required: true,
                          valueAsNumber: true,
                          min: 0,
                          max: 1
                        })}
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        placeholder="0.16"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tasa IVA 0% *
                      </label>
                      <input
                        {...register('tasaIva0', { 
                          required: true,
                          valueAsNumber: true,
                          min: 0,
                          max: 1
                        })}
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        placeholder="0.0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tasa IEPS (ej. alcohol)
                      </label>
                      <input
                        {...register('tasaIeps', { 
                          valueAsNumber: true,
                          min: 0
                        })}
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...register('descuentosAntesImpuestos')}
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm font-medium text-gray-700">
                      Aplicar descuentos antes de calcular impuestos
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Política de Redondeo *
                    </label>
                    <select
                      {...register('redondeo', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      <option value="redondeo">Redondeo</option>
                      <option value="truncar">Truncar</option>
                      <option value="exacto">Exacto (sin redondeo)</option>
                    </select>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Política de Propina</h4>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-800 font-semibold mb-2">
                        ⚠️ Importante Fiscal:
                      </p>
                      <p className="text-sm text-yellow-800 mb-2">
                        La propina puede tratarse de forma distinta según cómo se administre:
                      </p>
                      <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1 mb-2">
                        <li>Si es <strong>ingreso del restaurante</strong>: se factura como concepto</li>
                        <li>Si es <strong>recaudación para el personal</strong>: puede no facturarse</li>
                      </ul>
                      <p className="text-sm text-yellow-800 font-semibold">
                        Confirma con tu contador la política fiscal aplicable.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setValue('propinaFacturar', false)}>
                        <input
                          {...register('propinaFacturar')}
                          type="radio"
                          value="false"
                          checked={!watch('propinaFacturar')}
                          onChange={() => setValue('propinaFacturar', false)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <div className="ml-3 flex-1">
                          <label className="text-sm font-medium text-gray-700 cursor-pointer">
                            La propina NO se factura
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            Se maneja fuera del CFDI. La propina se registra internamente pero no aparece en la factura.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setValue('propinaFacturar', true)}>
                        <input
                          {...register('propinaFacturar')}
                          type="radio"
                          value="true"
                          checked={watch('propinaFacturar')}
                          onChange={() => setValue('propinaFacturar', true)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <div className="ml-3 flex-1">
                          <label className="text-sm font-medium text-gray-700 cursor-pointer">
                            La propina se factura como concepto del restaurante
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            Se integra al CFDI como concepto separado con su objeto de impuesto correspondiente.
                          </p>
                        </div>
                      </div>
                    </div>

                    {watch('propinaFacturar') && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Objeto de Impuesto para Propina *
                        </label>
                        <select
                          {...register('propinaObjetoImp', { required: watch('propinaFacturar') })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        >
                          {OBJETOS_IMP.map(obj => (
                            <option key={obj.clave} value={obj.clave}>
                              {obj.clave} - {obj.descripcion}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Generalmente "02" (Sí objeto de impuesto) para propinas que se facturan
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modo Fácil Paso 2: Decisiones clave */}
            {modoFacil && paso === 2 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">2. Decisiones clave</h3>
                  <p className="text-sm text-blue-800">
                    Factura global, propina y uso CFDI. El resto se completa con valores por defecto seguros.
                  </p>
                </div>
                <div className="flex items-center">
                  <input
                    {...register('facturaGlobalHabilitada')}
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Habilitar factura global (ventas sin datos del cliente)
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Uso CFDI por defecto (global)</label>
                  <select
                    {...register('facturaGlobalUsoCFDI', { required: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  >
                    {USOS_CFDI.filter(u => ['S01', 'G03', 'P01'].includes(u.clave)).map(u => (
                      <option key={u.clave} value={u.clave}>{u.clave} – {u.descripcion}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Siempre editable. Se valida contra el régimen antes de timbrar.</p>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Propina</h4>
                  <div className="flex items-center">
                    <input
                      {...register('propinaFacturar')}
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                    />
                    <span className="text-sm">Facturar propina como concepto</span>
                  </div>
                </div>
                <p className="text-sm text-amber-700">
                  ¿Opciones avanzadas? Cambia a <strong>Modo Avanzado</strong>.
                </p>
              </div>
            )}

            {/* Modo Fácil Paso 3: PAC, CSD, Conekta, Tiempos */}
            {modoFacil && paso === 3 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">3. PAC, CSD, Pagos y Tiempos</h3>
                  <p className="text-sm text-blue-800">
                    Datos necesarios para timbrar y operar. Mismos valores que en Modo Avanzado.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key PAC *</label>
                  <input
                    {...register('pacApiKey', { required: 'Requerido' })}
                    type="password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                    placeholder="key_..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modo PAC</label>
                  <select {...register('pacModo')} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black">
                    <option value="pruebas">Pruebas</option>
                    <option value="produccion">Producción</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ruta .cer *</label>
                  <input {...register('csdCerPath', { required: 'Requerido' })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black" placeholder="./certificados/restaurante.cer" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ruta .key *</label>
                  <input {...register('csdKeyPath', { required: 'Requerido' })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black" placeholder="./certificados/restaurante.key" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña CSD *</label>
                  <input {...register('csdPassword', { required: 'Requerido' })} type="password" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conekta Private Key *</label>
                  <input {...register('conektaPrivateKey', { required: 'Requerido' })} type="password" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black" placeholder="key_..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conekta Public Key *</label>
                  <input {...register('conektaPublicKey', { required: 'Requerido' })} type="password" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black" placeholder="key_..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min. amarillo</label>
                    <input {...register('tiempoAmarilloMinutos', { valueAsNumber: true })} type="number" min={1} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min. rojo</label>
                    <input {...register('tiempoRojoMinutos', { valueAsNumber: true })} type="number" min={1} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black" />
                  </div>
                </div>
              </div>
            )}

            {/* Paso 5: PAC (solo Avanzado) */}
            {!modoFacil && paso === 5 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">5. Configuración PAC (Proveedor Autorizado de Certificación)</h3>
                  <p className="text-sm text-blue-800">
                    Configure su cuenta del PAC para timbrar facturas electrónicas.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key del PAC *
                  </label>
                  <input
                    {...register('pacApiKey', { required: 'API Key es requerida' })}
                    type="password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="key_..."
                  />
                  {errors.pacApiKey && (
                    <p className="text-red-600 text-sm mt-1">{errors.pacApiKey.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Obtenga su API Key en su proveedor PAC (Facturación.com, SW, etc.)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modo *
                  </label>
                  <select
                    {...register('pacModo')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  >
                    <option value="pruebas">Pruebas (Desarrollo)</option>
                    <option value="produccion">Producción</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Use "Pruebas" para desarrollo y "Producción" para facturas reales
                  </p>
                </div>
              </div>
            )}

            {/* Paso 6: CSD (solo Avanzado) */}
            {!modoFacil && paso === 6 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">6. Certificado de Sello Digital (CSD)</h3>
                  <p className="text-sm text-blue-800">
                    Configure su certificado del SAT para firmar facturas electrónicas.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ruta al archivo .cer *
                  </label>
                  <input
                    {...register('csdCerPath', { required: 'Ruta al .cer es requerida' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    placeholder="./certificados/restaurante.cer"
                  />
                  {errors.csdCerPath && (
                    <p className="text-red-600 text-sm mt-1">{errors.csdCerPath.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Coloque el archivo .cer en la carpeta certificados/ del servidor
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ruta al archivo .key *
                  </label>
                  <input
                    {...register('csdKeyPath', { required: 'Ruta al .key es requerida' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    placeholder="./certificados/restaurante.key"
                  />
                  {errors.csdKeyPath && (
                    <p className="text-red-600 text-sm mt-1">{errors.csdKeyPath.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña del Certificado *
                  </label>
                  <input
                    {...register('csdPassword', { required: 'Contraseña es requerida' })}
                    type="password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contraseña del archivo .key"
                  />
                  {errors.csdPassword && (
                    <p className="text-red-600 text-sm mt-1">{errors.csdPassword.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Descargue su certificado en: <a href="https://www.sat.gob.mx" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">sat.gob.mx</a>
                  </p>
                </div>
              </div>
            )}

            {/* Paso 7: Factura Global (solo Avanzado) */}
            {!modoFacil && paso === 7 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">7. Factura Global (obligatoria en restaurantes)</h3>
                  <p className="text-sm text-blue-800">
                    Configure el módulo de factura global para ventas sin datos del cliente. Obligatorio para restaurantes.
                  </p>
                </div>

                <div className="flex items-center mb-4">
                  <input
                    {...register('facturaGlobalHabilitada')}
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Habilitar factura global
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RFC Receptor (Global) *
                    </label>
                    <input
                      {...register('facturaGlobalRfcReceptor', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="XAXX010101000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      RFC genérico para público en general
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Receptor (Global) *
                    </label>
                    <input
                      {...register('facturaGlobalNombreReceptor', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="PÚBLICO EN GENERAL"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Régimen Receptor (Global) *
                    </label>
                    <input
                      {...register('facturaGlobalRegimenReceptor', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="616"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Régimen 616 = Sin obligaciones fiscales
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Uso CFDI (Global) *
                    </label>
                    <select
                      {...register('facturaGlobalUsoCFDI', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      {USOS_CFDI.map(uso => (
                        <option key={uso.clave} value={uso.clave}>
                          {uso.clave} - {uso.descripcion}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Default: S01 (Sin efectos fiscales). Siempre editable. El sistema validará compatibilidad con el régimen antes de timbrar.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Periodicidad *
                    </label>
                    <select
                      {...register('facturaGlobalPeriodicidad', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      {PERIODICIDADES.map(per => (
                        <option key={per.clave} value={per.clave}>
                          {per.clave} - {per.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mes
                    </label>
                    <input
                      {...register('facturaGlobalMes', { 
                        valueAsNumber: true,
                        min: 1,
                        max: 12
                      })}
                      type="number"
                      min="1"
                      max="12"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="1-12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Año
                    </label>
                    <input
                      {...register('facturaGlobalAnio', { 
                        valueAsNumber: true,
                        min: 2020
                      })}
                      type="number"
                      min="2020"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="2024"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Política: Global → Nominativa</h4>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-orange-800 font-semibold mb-2">
                      ⚠️ Caso Común en Restaurantes:
                    </p>
                    <p className="text-sm text-orange-800 mb-2">
                      Cuando un cliente pide su factura <strong>después</strong> de que su consumo ya estaba incluido en la factura global:
                    </p>
                    <p className="text-sm text-orange-800">
                      El sistema debe tener una política definida para evitar duplicidad y caos contable.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Política cuando cliente pide factura después *
                    </label>
                    <select
                      {...register('facturaGlobalPoliticaNominativa', { required: true })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      defaultValue="emitir_sin_ajustar"
                    >
                      <option value="emitir_sin_ajustar">
                        Emitir nominativa sin ajustar global (recomendado para inicio)
                      </option>
                      <option value="cancelar_global_emitir_nominativa">
                        Cancelar global y emitir nominativa (requiere motivo 04)
                      </option>
                      <option value="ajustar_global_emitir_nominativa">
                        Ajustar global y emitir nominativa (nota de crédito parcial)
                      </option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      <strong>Recomendación:</strong> Valide con su contador cuál política aplicar. 
                      La política elegida se aplicará automáticamente y quedará documentada en el sistema.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 8: Conekta */}
            {paso === 8 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">8. Configuración de Pagos (Conekta)</h3>
                  <p className="text-sm text-blue-800">
                    Configure su cuenta de Conekta para procesar pagos.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Private Key de Conekta *
                  </label>
                  <input
                    {...register('conektaPrivateKey', { required: 'Private Key es requerida' })}
                    type="password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="key_..."
                  />
                  {errors.conektaPrivateKey && (
                    <p className="text-red-600 text-sm mt-1">{errors.conektaPrivateKey.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Public Key de Conekta *
                  </label>
                  <input
                    {...register('conektaPublicKey', { required: 'Public Key es requerida' })}
                    type="password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="key_..."
                  />
                  {errors.conektaPublicKey && (
                    <p className="text-red-600 text-sm mt-1">{errors.conektaPublicKey.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Obtenga sus keys en: <a href="https://conekta.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">conekta.com</a>
                  </p>
                </div>
              </div>
            )}

            {/* Paso 9: Tiempos de Mesas (solo Avanzado) */}
            {!modoFacil && paso === 9 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">9. Configuración de Tiempos para Mesas</h3>
                  <p className="text-sm text-blue-800">
                    Configure los rangos de tiempo para que las mesas cambien de color según el tiempo transcurrido desde la creación del pedido.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Verde:</strong> Tiempo normal (0 - {watch('tiempoAmarilloMinutos') || 30} minutos)<br />
                    <strong>Amarillo:</strong> Tiempo de advertencia ({watch('tiempoAmarilloMinutos') || 30} - {watch('tiempoRojoMinutos') || 60} minutos)<br />
                    <strong>Rojo:</strong> Tiempo crítico (más de {watch('tiempoRojoMinutos') || 60} minutos)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiempo para Amarillo (minutos) *
                  </label>
                  <input
                    {...register('tiempoAmarilloMinutos', { 
                      required: 'Tiempo es requerido',
                      min: { value: 1, message: 'Debe ser al menos 1 minuto' },
                      valueAsNumber: true
                    })}
                    type="number"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    placeholder="30"
                  />
                  {errors.tiempoAmarilloMinutos && (
                    <p className="text-red-600 text-sm mt-1">{errors.tiempoAmarilloMinutos.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Tiempo en minutos desde la creación del pedido para cambiar de verde a amarillo
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiempo para Rojo (minutos) *
                  </label>
                  <input
                    {...register('tiempoRojoMinutos', { 
                      required: 'Tiempo es requerido',
                      min: { value: 1, message: 'Debe ser al menos 1 minuto' },
                      validate: (value) => {
                        const numValue = Number(value)
                        if (isNaN(numValue)) return 'Tiempo es requerido'
                        const amarillo = watch('tiempoAmarilloMinutos') || 30
                        return numValue > amarillo || 'Debe ser mayor que el tiempo para amarillo'
                      },
                      valueAsNumber: true
                    })}
                    type="number"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    placeholder="60"
                  />
                  {errors.tiempoRojoMinutos && (
                    <p className="text-red-600 text-sm mt-1">{errors.tiempoRojoMinutos.message}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Tiempo en minutos desde la creación del pedido para cambiar de amarillo a rojo
                  </p>
                </div>
              </div>
            )}

            {/* Botones de navegación */}
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={pasoAnterior}
                disabled={paso === 1}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  paso === 1
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                Anterior
              </button>

              {paso < totalPasos ? (
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Guardando…' : 'Siguiente'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar Configuración Completa'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
