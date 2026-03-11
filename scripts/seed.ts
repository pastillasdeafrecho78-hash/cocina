import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  const adminRol = await prisma.rol.upsert({
    where: { codigo: 'ADMIN' },
    update: {},
    create: {
      nombre: 'Administrador',
      codigo: 'ADMIN',
      permisos: ['*'],
    },
  })

  const meseroRol = await prisma.rol.upsert({
    where: { codigo: 'MESERO' },
    update: {},
    create: {
      nombre: 'Mesero',
      codigo: 'MESERO',
      permisos: ['mesas', 'comandas', 'reportes'],
    },
  })

  const cocineroRol = await prisma.rol.upsert({
    where: { codigo: 'COCINERO' },
    update: {},
    create: {
      nombre: 'Cocinero',
      codigo: 'COCINERO',
      permisos: ['cocina'],
    },
  })

  // Crear usuario admin
  const hashedPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@restaurante.com' },
    update: {},
    create: {
      email: 'admin@restaurante.com',
      nombre: 'Admin',
      apellido: 'Sistema',
      password: hashedPassword,
      rolId: adminRol.id,
    },
  })
  console.log('✅ Usuario admin creado:', admin.email)

  // Crear usuario mesero
  const meseroPassword = await bcrypt.hash('mesero123', 12)
  const mesero = await prisma.usuario.upsert({
    where: { email: 'mesero@restaurante.com' },
    update: {},
    create: {
      email: 'mesero@restaurante.com',
      nombre: 'Juan',
      apellido: 'Mesero',
      password: meseroPassword,
      rolId: meseroRol.id,
    },
  })
  console.log('✅ Usuario mesero creado:', mesero.email)

  // Crear usuario cocinero
  const cocineroPassword = await bcrypt.hash('cocinero123', 12)
  const cocinero = await prisma.usuario.upsert({
    where: { email: 'cocinero@restaurante.com' },
    update: {},
    create: {
      email: 'cocinero@restaurante.com',
      nombre: 'Pedro',
      apellido: 'Cocinero',
      password: cocineroPassword,
      rolId: cocineroRol.id,
    },
  })
  console.log('✅ Usuario cocinero creado:', cocinero.email)

  // Crear mesas
  const mesas = []
  for (let i = 1; i <= 12; i++) {
    const mesa = await prisma.mesa.upsert({
      where: { numero: i },
      update: {},
      create: {
        numero: i,
        capacidad: i <= 4 ? 4 : i <= 8 ? 6 : 8,
        estado: 'LIBRE',
        ubicacion: i <= 6 ? 'Salón' : 'Terraza',
      },
    })
    mesas.push(mesa)
  }
  console.log(`✅ ${mesas.length} mesas creadas`)

  // Crear categorías (buscar primero, crear si no existen)
  let categoriaComida = await prisma.categoria.findFirst({
    where: { nombre: 'Comida', tipo: 'COMIDA' },
  })
  if (!categoriaComida) {
    categoriaComida = await prisma.categoria.create({
      data: {
        nombre: 'Comida',
        tipo: 'COMIDA',
        orden: 1,
      },
    })
  }

  let categoriaBebida = await prisma.categoria.findFirst({
    where: { nombre: 'Bebidas', tipo: 'BEBIDA' },
  })
  if (!categoriaBebida) {
    categoriaBebida = await prisma.categoria.create({
      data: {
        nombre: 'Bebidas',
        tipo: 'BEBIDA',
        orden: 2,
      },
    })
  }

  let categoriaPostre = await prisma.categoria.findFirst({
    where: { nombre: 'Postres', tipo: 'POSTRE' },
  })
  if (!categoriaPostre) {
    categoriaPostre = await prisma.categoria.create({
      data: {
        nombre: 'Postres',
        tipo: 'POSTRE',
        orden: 3,
      },
    })
  }

  console.log('✅ Categorías creadas')

  // Crear productos
  const productos = [
    {
      nombre: 'Tacos al Pastor',
      precio: 80,
      categoriaId: categoriaComida.id,
    },
    {
      nombre: 'Quesadillas',
      precio: 70,
      categoriaId: categoriaComida.id,
    },
    {
      nombre: 'Alambre',
      precio: 120,
      categoriaId: categoriaComida.id,
    },
    {
      nombre: 'Coca Cola',
      precio: 25,
      categoriaId: categoriaBebida.id,
    },
    {
      nombre: 'Agua Natural',
      precio: 20,
      categoriaId: categoriaBebida.id,
    },
    {
      nombre: 'Flan',
      precio: 45,
      categoriaId: categoriaPostre.id,
    },
  ]

  for (const producto of productos) {
    const existente = await prisma.producto.findFirst({
      where: {
        nombre: producto.nombre,
        categoriaId: producto.categoriaId,
      },
    })

    if (!existente) {
      await prisma.producto.create({
        data: producto,
      })
    }
  }
  console.log(`✅ ${productos.length} productos creados`)

  console.log('🎉 Seed completado exitosamente!')
  console.log('\nCredenciales de acceso:')
  console.log('Admin: admin@restaurante.com / admin123')
  console.log('Mesero: mesero@restaurante.com / mesero123')
  console.log('Cocinero: cocinero@restaurante.com / cocinero123')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
