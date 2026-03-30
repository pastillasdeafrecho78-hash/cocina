'use client'

import Link from 'next/link'
import BackButton from '@/components/BackButton'

export default function ConfiguracionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 text-black">
      <div className="max-w-3xl mx-auto">
        <BackButton className="mb-4" />

        <div className="bg-white shadow-md rounded-lg p-8 space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">Configuracion simplificada</h1>

          <p className="text-gray-700">
            Esta version prioriza una integracion plug-and-play con terminal Clip para pruebas.
            Ya no es obligatorio capturar PAC, CSD, Conekta ni datos fiscales para empezar a cobrar.
          </p>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Que si es necesario ahora</h2>
            <ul className="list-disc list-inside text-sm text-blue-900 space-y-1">
              <li>API key de Clip</li>
              <li>Numero de serie de la terminal Clip</li>
              <li>Comanda lista para cobro desde caja</li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            La facturacion CFDI se puede configurar despues como modulo independiente, sin bloquear
            el cobro con terminal Clip.
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/caja"
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Ir a Caja y conectar Clip
            </Link>
            <Link
              href="/dashboard"
              className="px-5 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300"
            >
              Volver al dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

