import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export class ApiHttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function raise(status: number, message: string, details?: unknown): never {
  throw new ApiHttpError(status, message, details)
}

export function toErrorResponse(
  error: unknown,
  fallbackMessage = 'Error interno del servidor',
  context?: string
) {
  if (error instanceof ApiHttpError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      { status: error.status }
    )
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: 'Datos inválidos', details: error.errors },
      { status: 400 }
    )
  }

  if (context) {
    console.error(context, error)
  } else {
    console.error(error)
  }
  return NextResponse.json({ success: false, error: fallbackMessage }, { status: 500 })
}
