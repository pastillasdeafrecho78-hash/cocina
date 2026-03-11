'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  fallbackHref?: string
  label?: string
  className?: string
}

export default function BackButton({
  fallbackHref = '/dashboard',
  label = '← Volver',
  className = '',
}: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  return (
    <button
      onClick={handleClick}
      className={`app-btn-secondary px-3.5 py-2 ${className}`}
      type="button"
    >
      {label}
    </button>
  )
}
