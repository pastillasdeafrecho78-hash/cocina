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
      className={`font-medium hover:opacity-80 ${className}`}
      style={{ color: 'rgba(69, 69, 69, 1)' }}
      type="button"
    >
      {label}
    </button>
  )
}
