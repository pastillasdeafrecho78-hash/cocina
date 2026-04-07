import type { OAuthProvider, Usuario } from '@prisma/client'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Facebook from 'next-auth/providers/facebook'
import Google from 'next-auth/providers/google'
import { PENDING_ACCESS_SLUG, ensurePendingAccessContext } from '@/lib/onboarding'

const secret =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.JWT_SECRET

const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET)
const facebookConfigured =
  Boolean(process.env.AUTH_META_ID) && Boolean(process.env.AUTH_META_SECRET)

function isOAuthProvider(provider: string): provider is OAuthProvider {
  return provider === 'google' || provider === 'facebook'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        restauranteId: { label: 'Restaurante', type: 'text' },
      },
      async authorize(credentials) {
        const { verifyPassword } = await import('@/lib/password')
        const { prisma } = await import('@/lib/prisma')
        const email = String(credentials?.email ?? '').trim().toLowerCase()
        const password = String(credentials?.password ?? '')
        const restauranteId = String(credentials?.restauranteId ?? '').trim()
        if (!email || !password) return null

        const where = restauranteId
          ? {
              restauranteId,
              email,
              activo: true,
              password: { not: null },
              restaurante: { activo: true },
            }
          : {
              email,
              activo: true,
              password: { not: null },
            }

        const user = await prisma.usuario.findFirst({
          where,
          include: {
            restaurante: {
              select: { slug: true, organizacionId: true },
            },
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        })
        if (!user?.password) return null
        const ok = await verifyPassword(password, user.password)
        if (!ok) return null

        const isPendingAccess = user.restaurante.slug === PENDING_ACCESS_SLUG

        await prisma.usuario
          .update({
            where: { id: user.id },
            data: {
              ultimoAcceso: new Date(),
              activeRestauranteId: isPendingAccess ? null : user.restauranteId,
              activeOrganizacionId: isPendingAccess ? null : user.restaurante.organizacionId ?? null,
            },
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
    ...(facebookConfigured
      ? [
          Facebook({
            clientId: process.env.AUTH_META_ID!,
            clientSecret: process.env.AUTH_META_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    /**
     * Google sin slug/cookie de tenant:
     * - Cuenta OAuth ya enlazada → entra como ese usuario.
     * - Un solo usuario activo con ese email (restaurante activo) → enlazar OAuth a ese usuario.
     * - Ningún usuario: si hay exactamente un Restaurante activo, crear usuario admin ahí; si hay varios, rechazar (registro/invitación).
     * - Varios usuarios con el mismo email → rechazar; debe usar email/contraseña y elegir restaurante en login.
     */
    async signIn({ account, profile }) {
      if (
        !account?.provider ||
        !isOAuthProvider(account.provider) ||
        !account.providerAccountId ||
        !profile?.email
      ) {
        return true
      }
      const { prisma } = await import('@/lib/prisma')
      const provider = account.provider
      const email = String(profile.email).toLowerCase()

      const existingLink = await prisma.cuentaOAuth.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId: account.providerAccountId,
          },
        },
        include: {
          usuario: {
            include: {
              restaurante: {
                select: { organizacionId: true },
              },
            },
          },
        },
      })
      if (existingLink?.usuario?.activo) {
        await prisma.sucursalMiembro
          .upsert({
            where: {
              usuarioId_restauranteId: {
                usuarioId: existingLink.usuario.id,
                restauranteId: existingLink.usuario.restauranteId,
              },
            },
            create: {
              usuarioId: existingLink.usuario.id,
              restauranteId: existingLink.usuario.restauranteId,
              rolId: existingLink.usuario.rolId,
              activo: true,
              esPrincipal: true,
            },
            update: { activo: true },
          })
          .catch(() => {})
        if (existingLink.usuario.restaurante.organizacionId) {
          await prisma.organizacionMiembro
            .upsert({
              where: {
                usuarioId_organizacionId: {
                  usuarioId: existingLink.usuario.id,
                  organizacionId: existingLink.usuario.restaurante.organizacionId,
                },
              },
              create: {
                usuarioId: existingLink.usuario.id,
                organizacionId: existingLink.usuario.restaurante.organizacionId,
                rolId: existingLink.usuario.rolId,
                activo: true,
              },
              update: { activo: true },
            })
            .catch(() => {})
        }
        await prisma.usuario
          .update({
            where: { id: existingLink.usuario.id },
            data: {
              ultimoAcceso: new Date(),
              activeRestauranteId: existingLink.usuario.restauranteId,
              activeOrganizacionId: existingLink.usuario.restaurante.organizacionId ?? null,
            },
          })
          .catch(() => {})
        await prisma.auditoria
          .create({
            data: {
              restauranteId: existingLink.usuario.restauranteId,
              usuarioId: existingLink.usuario.id,
              accion: 'LOGIN',
              entidad: 'Usuario',
              entidadId: existingLink.usuario.id,
              detalles: { via: provider },
            },
          })
          .catch(() => {})
        return true
      }

      const sameEmail = await prisma.usuario.findMany({
        where: {
          email,
          activo: true,
          restaurante: { activo: true },
        },
        include: {
          restaurante: {
            select: {
              organizacionId: true,
            },
          },
        },
      })

      if (sameEmail.length > 1) {
        return '/login?error=social_multi'
      }

      const nombre =
        (profile as { given_name?: string }).given_name ?? email.split('@')[0]
      const apellido = (profile as { family_name?: string }).family_name ?? ''

      let dbUser: Usuario & { restaurante: { organizacionId: string | null } }

      if (sameEmail.length === 1) {
        dbUser = sameEmail[0]
      } else {
        const pending = await ensurePendingAccessContext(prisma)
        dbUser = await prisma.usuario.create({
          data: {
            email,
            nombre,
            apellido,
            password: null,
            restauranteId: pending.restauranteId,
            rolId: pending.rolId,
            activeRestauranteId: null,
            activeOrganizacionId: null,
          },
          include: {
            restaurante: {
              select: {
                organizacionId: true,
              },
            },
          },
        })
      }

      await prisma.cuentaOAuth.upsert({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          usuarioId: dbUser.id,
          provider,
          providerAccountId: account.providerAccountId,
        },
        update: { usuarioId: dbUser.id },
      })
      await prisma.sucursalMiembro
        .upsert({
          where: {
            usuarioId_restauranteId: {
              usuarioId: dbUser.id,
              restauranteId: dbUser.restauranteId,
            },
          },
          create: {
            usuarioId: dbUser.id,
            restauranteId: dbUser.restauranteId,
            rolId: dbUser.rolId,
            activo: true,
            esPrincipal: true,
          },
          update: { activo: true },
        })
        .catch(() => {})
      if (dbUser.restaurante.organizacionId) {
        await prisma.organizacionMiembro
          .upsert({
            where: {
              usuarioId_organizacionId: {
                usuarioId: dbUser.id,
                organizacionId: dbUser.restaurante.organizacionId,
              },
            },
            create: {
              usuarioId: dbUser.id,
              organizacionId: dbUser.restaurante.organizacionId,
              rolId: dbUser.rolId,
              activo: true,
            },
            update: { activo: true },
          })
          .catch(() => {})
      }
      const pendingContext = await ensurePendingAccessContext(prisma)
      const isPendingOnly = dbUser.restauranteId === pendingContext.restauranteId
      await prisma.usuario
        .update({
          where: { id: dbUser.id },
          data: {
            ultimoAcceso: new Date(),
            activeRestauranteId: isPendingOnly ? null : dbUser.restauranteId,
            activeOrganizacionId: isPendingOnly ? null : dbUser.restaurante.organizacionId ?? null,
          },
        })
        .catch(() => {})

      await prisma.auditoria
        .create({
          data: {
            restauranteId: dbUser.restauranteId,
            usuarioId: dbUser.id,
            accion: 'LOGIN',
            entidad: 'Usuario',
            entidadId: dbUser.id,
            detalles: { via: provider },
          },
        })
        .catch(() => {})

      return true
    },
    async jwt({ token, user, account }) {
      const { prisma } = await import('@/lib/prisma')
      async function resolveEffectiveRolId(input: {
        userId: string
        activeRestauranteId: string | null
        restauranteId: string
        fallbackRolId: string
      }): Promise<string> {
        const scopeRestauranteId = input.activeRestauranteId ?? input.restauranteId
        const membership = await prisma.sucursalMiembro.findUnique({
          where: {
            usuarioId_restauranteId: {
              usuarioId: input.userId,
              restauranteId: scopeRestauranteId,
            },
          },
          select: { rolId: true },
        })
        return membership?.rolId ?? input.fallbackRolId
      }

      if (account?.provider && isOAuthProvider(account.provider) && account.providerAccountId) {
        const provider = account.provider
        const link = await prisma.cuentaOAuth.findUnique({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId: account.providerAccountId,
            },
          },
          include: {
            usuario: {
              include: {
                restaurante: {
                  select: { organizacionId: true },
                },
              },
            },
          },
        })
        if (link?.usuario?.activo) {
          const u = link.usuario
          token.userId = u.id
          token.rolId = await resolveEffectiveRolId({
            userId: u.id,
            activeRestauranteId: u.activeRestauranteId,
            restauranteId: u.restauranteId,
            fallbackRolId: u.rolId,
          })
          token.restauranteId = u.activeRestauranteId ?? u.restauranteId
          token.activeRestauranteId = u.activeRestauranteId ?? u.restauranteId
          token.activeOrganizacionId = u.activeOrganizacionId ?? u.restaurante.organizacionId ?? undefined
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
            activeRestauranteId: true,
            activeOrganizacionId: true,
            email: true,
            nombre: true,
            apellido: true,
          },
        })
        if (u) {
          token.rolId = await resolveEffectiveRolId({
            userId: user.id,
            activeRestauranteId: u.activeRestauranteId,
            restauranteId: u.restauranteId,
            fallbackRolId: u.rolId,
          })
          token.restauranteId = u.activeRestauranteId ?? u.restauranteId
          token.activeRestauranteId = u.activeRestauranteId ?? u.restauranteId
          token.activeOrganizacionId = u.activeOrganizacionId ?? undefined
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
        session.user.activeRestauranteId = (token.activeRestauranteId as string) ?? undefined
        session.user.activeOrganizacionId = (token.activeOrganizacionId as string) ?? undefined
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
