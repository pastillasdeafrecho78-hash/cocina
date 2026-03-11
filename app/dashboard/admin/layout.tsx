'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tienePermiso } from '@/lib/permisos'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      router.replace('/login')
      setChecking(false)
      return
    }
    const user = JSON.parse(userStr)
    if (!tienePermiso(user, 'usuarios_roles')) {
      router.replace('/dashboard')
      setChecking(false)
      return
    }
    setChecking(false)
  }, [router])

  if (checking) {
    return (
      <div className="app-loading-shell">
        <div className="app-card text-center">
          <p className="app-kicker">Administración</p>
          <div className="mt-2 text-lg font-medium text-stone-700">Verificando permisos...</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
