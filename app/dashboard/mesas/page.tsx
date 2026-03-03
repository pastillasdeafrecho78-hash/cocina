'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MesasPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/mesas/status')
  }, [router])

  return (
    <div className="p-8 flex items-center justify-center min-h-[200px]">
      <div className="text-gray-500">Redirigiendo a mesas...</div>
    </div>
  )
}
