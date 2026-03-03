'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      clearSession()
      router.replace('/login')
      setChecking(false)
      return
    }

    let cancelled = false
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (cancelled) return
        if (res.status === 401) {
          clearSession()
          router.replace('/login')
          setChecking(false)
          return
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled || !data) return
        if (!data.success || !data.data) {
          clearSession()
          router.replace('/login')
          setChecking(false)
          return
        }
        const u = data.data
        if (!u.activo) {
          clearSession()
          router.replace('/login')
          setChecking(false)
          return
        }
        localStorage.setItem('user', JSON.stringify(u))
        setUser(u)
        setChecking(false)
      })
      .catch(() => {
        if (!cancelled) {
          clearSession()
          router.replace('/login')
          setChecking(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [router])

  if (checking || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Verificando sesión...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main>{children}</main>
    </div>
  )
}








