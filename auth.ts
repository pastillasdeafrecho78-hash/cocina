import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { verifyPassword } from '@/lib/password'

const secret =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.JWT_SECRET

const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        slug: { label: 'Slug', type: 'text' },
      },
      async authorize(credentials) {
        const { prisma } = await import('@/lib/prisma')
        const email = String(credentials?.email ?? '').trim()
        const password = String(credentials?.password ?? '')
        const slug = String(credentials?.slug ?? 'principal').trim() || 'principal'
        if (!email || !password) return null

        const restaurante = await prisma.restaurante.findFirst({
          where: { slug, activo: true },
        })
        if (!restaurante) return null

        const user = await prisma.usuario.findUnique({
          where: {
            restauranteId_email: { restauranteId: restaurante.id, email },
          },
        })
        if (!user?.activo || !user.password) return null
        const ok = await verifyPassword(password, user.password)
        if (!ok) return null

        await prisma.usuario
          .update({
            where: { id: user.id },
            data: { ultimoAcceso: new Date() },
          })
          .catch(() => {})

        await prisma.auditoria
          .create({
            data: {
              restauranteId: user.restauranteId,
              usuarioId: user.id,
              accion: 'LOGIN',
              entidad: 'Usuario',
              entidadId: user.id,
            },
          })
          .catch(() => {})

        return {
          id: user.id,
          email: user.email,
          name: `${user.nombre} ${user.apellido}`,
        }
      },
    }),
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google' || !account.providerAccountId || !profile?.email) {
        return true
      }
      const { prisma } = await import('@/lib/prisma')
      const { cookies } = await import('next/headers')
      const email = String(profile.email).toLowerCase()
      let slug = 'principal'
      try {
        const c = (await cookies()).get('oauth_slug')?.value?.trim()
        if (c) slug = c
      } catch {
        /* ignore */
      }

      const restaurante = await prisma.restaurante.findFirst({
        where: { slug, activo: true },
      })
      if (!restaurante) return false

      const existingLink = await prisma.cuentaOAuth.findUnique({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: account.providerAccountId,
          },
        },
        include: { usuario: true },
      })
      if (existingLink?.usuario?.activo) {
        await prisma.auditoria
          .create({
            data: {
              restauranteId: existingLink.usuario.restauranteId,
              usuarioId: existingLink.usuario.id,
              accion: 'LOGIN',
              entidad: 'Usuario',
              entidadId: existingLink.usuario.id,
              detalles: { via: 'google' },
            },
          })
          .catch(() => {})
        return true
      }

      let dbUser = await prisma.usuario.findUnique({
        where: {
          restauranteId_email: { restauranteId: restaurante.id, email },
        },
      })

      const nombre =
        (profile as { given_name?: string }).given_name ?? email.split('@')[0]
      const apellido = (profile as { family_name?: string }).family_name ?? ''

      if (!dbUser) {
        const rol =
          (await prisma.rol.findFirst({ where: { codigo: 'admin' } })) ??
          (await prisma.rol.findFirst())
        if (!rol) return false
        dbUser = await prisma.usuario.create({
          data: {
            email,
            nombre,
            apellido,
            password: null,
            restauranteId: restaurante.id,
            rolId: rol.id,
          },
        })
      }

      await prisma.cuentaOAuth.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          usuarioId: dbUser.id,
          provider: 'google',
          providerAccountId: account.providerAccountId,
        },
        update: { usuarioId: dbUser.id },
      })

      await prisma.auditoria
        .create({
          data: {
            restauranteId: dbUser.restauranteId,
            usuarioId: dbUser.id,
            accion: 'LOGIN',
            entidad: 'Usuario',
            entidadId: dbUser.id,
            detalles: { via: 'google' },
          },
        })
        .catch(() => {})

      return true
    },
    async jwt({ token, user, account }) {
      const { prisma } = await import('@/lib/prisma')
      if (account?.provider === 'google' && account.providerAccountId) {
        const link = await prisma.cuentaOAuth.findUnique({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: account.providerAccountId,
            },
          },
          include: { usuario: true },
        })
        if (link?.usuario?.activo) {
          const u = link.usuario
          token.userId = u.id
          token.rolId = u.rolId
          token.restauranteId = u.restauranteId
          token.email = u.email
          token.name = `${u.nombre} ${u.apellido}`
        }
        return token
      }

      if (user?.id) {
        token.userId = user.id
        const u = await prisma.usuario.findUnique({
          where: { id: user.id },
          select: {
            rolId: true,
            restauranteId: true,
            email: true,
            nombre: true,
            apellido: true,
          },
        })
        if (u) {
          token.rolId = u.rolId
          token.restauranteId = u.restauranteId
          token.email = u.email
          token.name = `${u.nombre} ${u.apellido}`
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string
        session.user.rolId = token.rolId as string
        session.user.restauranteId = token.restauranteId as string
        session.user.email = (token.email as string) ?? session.user.email
        session.user.name = (token.name as string) ?? session.user.name
      }
      return session
    },
  },
  session: { strategy: 'jwt', maxAge: 86400 },
  pages: {
    signIn: '/login',
  },
})
