'use client'

import Link from 'next/link'
import BackButton from '@/components/BackButton'
import ClipConfigSection from './ClipConfigSection'
import RolloutStatusSection from './RolloutStatusSection'
import TenantIdentitySection from './TenantIdentitySection'

export default function ConfiguracionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 text-black">
      <div className="max-w-3xl mx-auto">
        <BackButton className="mb-4" />

        <div className="bg-white shadow-md rounded-lg p-8 space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>

          <p className="text-gray-700">
            Aquí administras la integración de Clip y las terminales autorizadas para tu restaurante.
          </p>

          <ClipConfigSection />
          <TenantIdentitySection />
          <RolloutStatusSection />

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/caja"
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Ir a Caja
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
