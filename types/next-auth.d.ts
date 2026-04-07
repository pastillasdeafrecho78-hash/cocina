import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      rolId: string
      restauranteId: string
      activeRestauranteId?: string
      activeOrganizacionId?: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    rolId?: string
    restauranteId?: string
    activeRestauranteId?: string
    activeOrganizacionId?: string
  }
}
