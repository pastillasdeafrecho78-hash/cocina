import { prisma } from '@/lib/prisma'
import { calcularTotal, generarNumeroComanda } from '@/lib/comanda-helpers'

type AprobacionModo = 'MANUAL_APPROVE' | 'MANUAL_FORCE' | 'AUTO_APPROVE' | 'AUTO_QUEUE_PROMOTION'

export async function aprobarSolicitudComoComanda(input: {
  solicitudId: string
  restauranteId: string
  actorUserId: string
  modo: AprobacionModo
  reason?: string
}) {
  const solicitud = await prisma.solicitudPedido.findFirst({
    where: {
      id: input.solicitudId,
      restauranteId: input.restauranteId,
    },
    include: {
      items: {
        include: {
          modificadores: true,
          producto: {
            select: {
              listoPorDefault: true,
            },
          },
        },
      },
    },
  })

  if (!solicitud) {
    throw new Error('Solicitud no encontrada')
  }

  if (!['PENDIENTE', 'EN_COLA'].includes(solicitud.estado)) {
    throw new Error('Solo se pueden aprobar solicitudes pendientes o en cola')
  }

  if (solicitud.tipoPedido === 'MESA' && !solicitud.mesaId) {
    throw new Error('La solicitud de mesa no tiene mesa asociada')
  }

  const total = calcularTotal(
    solicitud.items.map((item) => ({
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      precioModificadores: 0,
    }))
  )
  const numeroComanda = await generarNumeroComanda(input.restauranteId)

  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.create({
      data: {
        restauranteId: input.restauranteId,
        nombre: solicitud.nombreCliente,
        telefono: solicitud.telefono || null,
        notas: solicitud.notas || null,
      },
      select: { id: true },
    })

    if (solicitud.mesaId) {
      await tx.mesa.update({
        where: { id: solicitud.mesaId },
        data: { estado: 'OCUPADA' },
      })
    }

    const comanda = await tx.comanda.create({
      data: {
        restauranteId: input.restauranteId,
        numeroComanda,
        mesaId: solicitud.mesaId,
        clienteId: cliente.id,
        tipoPedido:
          solicitud.tipoPedido === 'MESA'
            ? 'EN_MESA'
            : solicitud.tipoPedido === 'ENVIO'
              ? 'A_DOMICILIO'
              : 'PARA_LLEVAR',
        origen: 'PUBLIC_LINK',
        total,
        observaciones: [solicitud.observaciones, `Aprobada (${input.modo})`].filter(Boolean).join(' | '),
        creadoPorId: input.actorUserId,
        asignadoAId: solicitud.mesaId ? input.actorUserId : null,
        items: {
          create: solicitud.items.map((item) => {
            const listoPorDefault = item.producto.listoPorDefault === true
            return {
              productoId: item.productoId,
              tamanoId: item.tamanoId,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.subtotal,
              notas: item.notas,
              destino: item.destino,
              numeroRonda: 1,
              ...(listoPorDefault ? { estado: 'LISTO' as const, fechaListo: new Date() } : {}),
              modificadores: {
                create: item.modificadores.map((m) => ({
                  modificadorId: m.modificadorId,
                  precioExtra: m.precioExtra,
                })),
              },
            }
          }),
        },
        historial: {
          create: {
            accion: 'CREADA',
            descripcion: `Comanda creada al aprobar solicitud ${solicitud.id}`,
            usuarioId: input.actorUserId,
          },
        },
      },
      select: {
        id: true,
        numeroComanda: true,
        estado: true,
        total: true,
      },
    })

    await tx.solicitudPedido.update({
      where: { id: solicitud.id },
      data: {
        estado: 'APROBADA',
        aprobadaAt: new Date(),
        approvedComandaId: comanda.id,
        reviewedById: input.actorUserId,
        decisionSource: input.modo,
        decisionReason: input.reason ?? null,
      },
    })

    await tx.auditoria.create({
      data: {
        restauranteId: input.restauranteId,
        usuarioId: input.actorUserId,
        accion: 'SOLICITUD_APROBADA',
        entidad: 'SolicitudPedido',
        entidadId: solicitud.id,
        detalles: {
          modo: input.modo,
          comandaId: comanda.id,
          reason: input.reason ?? null,
        },
      },
    })

    return comanda
  })
}
