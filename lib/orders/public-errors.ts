import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export class CanonicalApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
  }
}

export function raiseApiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): never {
  throw new CanonicalApiError(status, code, message, details)
}

export function jsonError(
  status: number,
  code: string,
  error: string,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error,
      code,
      ...(details ? { details } : {}),
    },
    { status }
  )
}

export function toCanonicalErrorResponse(error: unknown) {
  if (error instanceof CanonicalApiError) {
    return jsonError(error.status, error.code, error.message, error.details)
  }

  if (error instanceof ZodError) {
    return jsonError(400, 'invalid_payload', 'Datos inválidos', {
      issues: error.errors,
    })
  }

  return jsonError(500, 'internal_error', 'Error interno del servidor')
}
