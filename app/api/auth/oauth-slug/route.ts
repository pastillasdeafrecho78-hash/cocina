import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({ slug: z.string().min(1).max(80) })

/** Cookie corta para el flujo Google: elegir restaurante (slug) antes de OAuth. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug } = schema.parse(body)
    const res = NextResponse.json({ success: true })
    const secure = process.env.NODE_ENV === 'production'
    res.headers.set(
      'Set-Cookie',
      `oauth_slug=${encodeURIComponent(slug)}; Path=/; Max-Age=600; SameSite=Lax${secure ? '; Secure' : ''}`
    )
    return res
  } catch {
    return NextResponse.json({ success: false, error: 'Slug inválido' }, { status: 400 })
  }
}
