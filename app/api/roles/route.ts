import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth-server'
import { tienePermiso } from '@/lib/permisos'
import { z } from 'zod'

const createRolSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  codigo: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  permisos: z.array(z.string()).min(1, 'Debe incluir al menos un permiso'),
})

/**
 * GET /api/roles
 * Lista todos los roles. Solo usuarios con permiso usuarios_roles.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'staff.manage')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const roles = await prisma.rol.findMany({
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: roles.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        codigo: r.codigo,
        descripcion: r.descripcion,
        permisos: r.permisos as string[],
        numUsuarios: r._count.usuarios,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Error en GET /api/roles:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/roles
 * Crea un nuevo rol. Solo usuarios con permiso usuarios_roles.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }
    if (!tienePermiso(user, 'staff.manage')) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const data = createRolSchema.parse(body)

    if (data.codigo) {
      const existente = await prisma.rol.findUnique({
        where: { codigo: data.codigo },
      })
      if (existente) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un rol con ese código' },
          { status: 400 }
        )
      }
    }

    const rol = await prisma.rol.create({
      data: {
        nombre: data.nombre,
        codigo: data.codigo || null,
        descripcion: data.descripcion || null,
        permisos: data.permisos,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: rol.id,
          nombre: rol.nombre,
          codigo: rol.codigo,
          descripcion: rol.descripcion,
          permisos: rol.permisos as string[],
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error en POST /api/roles:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
