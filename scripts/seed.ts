import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  let restaurante = await prisma.restaurante.findUnique({
    where: { slug: 'principal' },
  })
  if (!restaurante) {
    restaurante = await prisma.restaurante.create({
      data: { nombre: 'Restaurante principal', slug: 'principal' },
    })
  }
  const rid = restaurante.id
  console.log('✅ Restaurante:', restaurante.nombre, rid)

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
    update: { permisos: ['mesas', 'comandas', 'reportes', 'caja'] },
    create: {
      nombre: 'Mesero',
      codigo: 'MESERO',
      permisos: ['mesas', 'comandas', 'reportes', 'caja'],
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

  const hashedPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.usuario.upsert({
    where: {
      restauranteId_email: { restauranteId: rid, email: 'admin@restaurante.com' },
    },
    update: {},
    create: {
      restauranteId: rid,
      email: 'admin@restaurante.com',
      nombre: 'Admin',
      apellido: 'Sistema',
      password: hashedPassword,
      rolId: adminRol.id,
    },
  })
  console.log('✅ Usuario admin:', admin.email)

  const meseroPassword = await bcrypt.hash('mesero123', 12)
  const mesero = await prisma.usuario.upsert({
    where: {
      restauranteId_email: { restauranteId: rid, email: 'mesero@restaurante.com' },
    },
    update: {},
    create: {
      restauranteId: rid,
      email: 'mesero@restaurante.com',
      nombre: 'Juan',
      apellido: 'Mesero',
      password: meseroPassword,
      rolId: meseroRol.id,
    },
  })
  console.log('✅ Usuario mesero:', mesero.email)

  const cocineroPassword = await bcrypt.hash('cocinero123', 12)
  const cocinero = await prisma.usuario.upsert({
    where: {
      restauranteId_email: { restauranteId: rid, email: 'cocinero@restaurante.com' },
    },
    update: {},
    create: {
      restauranteId: rid,
      email: 'cocinero@restaurante.com',
      nombre: 'Pedro',
      apellido: 'Cocinero',
      password: cocineroPassword,
      rolId: cocineroRol.id,
    },
  })
  console.log('✅ Usuario cocinero:', cocinero.email)

  const mesas = []
  for (let i = 1; i <= 12; i++) {
    const mesa = await prisma.mesa.upsert({
      where: {
        restauranteId_numero: { restauranteId: rid, numero: i },
      },
      update: {},
      create: {
        restauranteId: rid,
        numero: i,
        capacidad: i <= 4 ? 4 : i <= 8 ? 6 : 8,
        estado: 'LIBRE',
        ubicacion: i <= 6 ? 'Salón' : 'Terraza',
      },
    })
    mesas.push(mesa)
  }
  console.log(`✅ ${mesas.length} mesas`)

  let categoriaComida = await prisma.categoria.findFirst({
    where: { restauranteId: rid, nombre: 'Comida', tipo: 'COMIDA' },
  })
  if (!categoriaComida) {
    categoriaComida = await prisma.categoria.create({
      data: {
        restauranteId: rid,
        nombre: 'Comida',
        tipo: 'COMIDA',
        orden: 1,
      },
    })
  }

  let categoriaBebida = await prisma.categoria.findFirst({
    where: { restauranteId: rid, nombre: 'Bebidas', tipo: 'BEBIDA' },
  })
  if (!categoriaBebida) {
    categoriaBebida = await prisma.categoria.create({
      data: {
        restauranteId: rid,
        nombre: 'Bebidas',
        tipo: 'BEBIDA',
        orden: 2,
      },
    })
  }

  let categoriaPostre = await prisma.categoria.findFirst({
    where: { restauranteId: rid, nombre: 'Postres', tipo: 'POSTRE' },
  })
  if (!categoriaPostre) {
    categoriaPostre = await prisma.categoria.create({
      data: {
        restauranteId: rid,
        nombre: 'Postres',
        tipo: 'POSTRE',
        orden: 3,
      },
    })
  }

  const productos = [
    { nombre: 'Tacos al Pastor', precio: 80, categoriaId: categoriaComida.id },
    { nombre: 'Quesadillas', precio: 70, categoriaId: categoriaComida.id },
    { nombre: 'Alambre', precio: 120, categoriaId: categoriaComida.id },
    { nombre: 'Coca Cola', precio: 25, categoriaId: categoriaBebida.id },
    { nombre: 'Agua Natural', precio: 20, categoriaId: categoriaBebida.id },
    { nombre: 'Flan', precio: 45, categoriaId: categoriaPostre.id },
  ]
  for (const producto of productos) {
    const existente = await prisma.producto.findFirst({
      where: { nombre: producto.nombre, categoriaId: producto.categoriaId },
    })
    if (!existente) {
      await prisma.producto.create({ data: producto })
    }
  }
  console.log(`✅ ${productos.length} productos`)

  console.log('🎉 Seed OK — Admin admin@restaurante.com / admin123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
