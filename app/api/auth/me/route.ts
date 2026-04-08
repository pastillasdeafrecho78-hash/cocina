import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/authz/guards'
import { toErrorResponse } from '@/lib/authz/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    return toErrorResponse(error, 'Error interno del servidor', 'Error en /api/auth/me:')
  }
}
