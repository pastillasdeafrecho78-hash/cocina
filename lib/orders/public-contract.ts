import { z } from 'zod'

export const createExternalOrderBodySchema = z.object({
  externalOrderId: z.string().min(1).max(120),
  source: z.string().min(1).max(80).optional(),
  canal: z.string().min(1).max(80).optional(),
  tipoPedido: z
    .enum(['PARA_LLEVAR', 'A_DOMICILIO', 'WHATSAPP', 'DELIVERY'])
    .default('A_DOMICILIO'),
  catalogVersion: z.string().max(80).optional(),
  observaciones: z.string().max(320).optional(),
  cliente: z
    .object({
      nombre: z.string().min(1).max(120),
      telefono: z.string().max(40).optional(),
      direccion: z.string().max(220).optional(),
      notas: z.string().max(240).optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        tamanoId: z.string().optional(),
        cantidad: z.number().int().positive(),
        notas: z.string().max(240).optional(),
        modificadores: z
          .array(
            z.object({
              modificadorId: z.string().min(1),
            })
          )
          .max(20)
          .optional()
          .default([]),
      })
    )
    .min(1)
    .max(50),
})

export type CreateExternalOrderBody = z.infer<typeof createExternalOrderBodySchema>

export function normalizeTipoPedido(tipo: 'PARA_LLEVAR' | 'A_DOMICILIO' | 'WHATSAPP' | 'DELIVERY') {
  return tipo === 'DELIVERY' ? 'A_DOMICILIO' : tipo
}
