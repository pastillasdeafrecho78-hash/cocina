'use client'

import Image from 'next/image'
import { useTheme } from '@/components/ThemeProvider'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  priority?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'h-10 w-[170px]',
  md: 'h-14 w-[240px]',
  lg: 'h-20 w-[320px]',
  xl: 'h-28 w-[460px]',
}

export default function BrandLogo({
  size = 'md',
  priority = false,
  className = '',
}: BrandLogoProps) {
  const { resolvedTheme, mounted } = useTheme()
  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-[4%] inset-y-[10%] -z-10 scale-[1.08] blur-3xl ${
          isDark ? 'opacity-80' : 'opacity-95'
        }`}
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 55% 50%, rgba(255,247,237,0.48) 0%, rgba(251,146,60,0.36) 18%, rgba(249,115,22,0.28) 30%, rgba(220,38,38,0.18) 46%, rgba(127,29,29,0.08) 60%, transparent 78%)'
            : 'radial-gradient(ellipse at 58% 48%, rgba(127,29,29,0.34) 0%, rgba(153,27,27,0.22) 18%, rgba(127,29,29,0.12) 34%, transparent 62%)',
        }}
      />
      <Image
        src="/branding/servimos-logo.png"
        alt="ServimOS"
        fill
        priority={priority}
        sizes="(max-width: 768px) 240px, (max-width: 1280px) 320px, 460px"
        className={`object-contain ${
          isDark
            ? 'drop-shadow-[0_0_24px_rgba(249,115,22,0.16)]'
            : 'drop-shadow-[0_10px_30px_rgba(127,29,29,0.22)]'
        }`}
        unoptimized
      />
    </div>
  )
}
