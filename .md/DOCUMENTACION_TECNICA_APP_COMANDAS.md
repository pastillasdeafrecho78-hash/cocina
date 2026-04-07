# Documentación Técnica: Sistema de Comandas

## 1. Resumen ejecutivo

Aplicación operativa para restaurantes con enfoque multi-sucursal y soporte opcional de organización.
El dominio principal cubre mesas, comandas, cocina/barra, carta, caja, usuarios/roles e integraciones.

Estado actual de arquitectura:

- Framework: Next.js (App Router) con Route Handlers en `app/api/**`.
- Persistencia: PostgreSQL + Prisma.
- Autenticación: NextAuth con estrategia de sesión JWT.
- Autorización: permisos híbridos (legacy + capacidades) evaluados server-side.
- Tenancy: contexto activo por sucursal/organización + membresías.

## 2. Arquitectura y capas

### 2.1 Capa web/API

- UI y API conviven en el mismo monolito Next.js.
- Las APIs se implementan en `app/api/**/route.ts`.
- El middleware autentica (no autoriza por recurso/capacidad).

### 2.2 Capa de dominio/autorización

Archivos clave:

- `lib/auth-server.ts`: resuelve usuario de sesión + contexto activo + rol efectivo.
- `lib/permisos.ts`: evaluación de permisos legacy/capacidades.
- `lib/tenant.ts`: resolución de tenant operativo a partir de contexto activo.
- `lib/menu-context.ts`: lectura de menú efectiva para estrategias multisucursal.

## 3. Modelo de datos (actual)

Referencia canónica: `prisma/schema.prisma`.

### 3.1 Entidades de tenancy

- `Organizacion`
- `Restaurante`
- `Usuario`
- `SucursalMiembro` (usuario ↔ sucursal)
- `OrganizacionMiembro` (usuario ↔ organización)

### 3.2 Roles y permisos

- `Rol` con `permisos` (JSON) como lista de códigos.
- Compatibilidad híbrida en runtime:
  - módulos legacy (`mesas`, `carta`, `usuarios_roles`, etc.)
  - capacidades granulares (`menu.manage`, `staff.manage`, etc.)

### 3.3 Evolución reciente aplicada

Se introdujo `rolId` en membresías:

- `SucursalMiembro.rolId`
- `OrganizacionMiembro.rolId`

Migración aplicada en repo:

- `prisma/migrations/20260407180000_membership_rol_id/migration.sql`

Incluye backfill inicial desde `Usuario.rolId` para mantener compatibilidad.

### 3.4 Campos de contexto activo

En `Usuario`:

- `activeRestauranteId`
- `activeOrganizacionId`

Estos campos se reflejan en sesión y se corrigen cuando el contexto activo ya no es válido.

## 4. Autenticación y autorización

## 4.1 Autenticación

- NextAuth (`auth.ts`) con credenciales y OAuth (Google/Facebook).
- Estrategia de sesión JWT (`session.strategy = 'jwt'`).
- Callback JWT incluye `userId`, `rolId`, `restauranteId`, `activeRestauranteId`, `activeOrganizacionId`.

## 4.2 Fuente de rol efectiva

La autorización server-side usa `getSessionUser()`:

1. Resuelve sucursal activa válida por membresía.
2. Busca membresía activa de esa sucursal.
3. Usa `SucursalMiembro.rolId` como `effectiveRolId`.
4. Hace fallback a `Usuario.rolId` si falta `rolId` en membresía.

Respuesta del helper incluye:

- `rol` (objeto de rol efectivo)
- `rolId` (efectivo)
- `legacyRolId` (de compatibilidad)
- `effectiveRolId`

## 4.3 Permisos

`lib/permisos.ts` expone:

- `tienePermiso(user, permission)`
- `tieneAlgunPermiso(...)`
- mapeos bidireccionales legacy/capacidad

Regla operativa:

- Middleware valida autenticación.
- Cada handler debe validar permisos/capacidad y alcance de tenant/recurso.

## 5. Multitenancy operativo

## 5.1 Reglas de acceso

- Un usuario opera en la sucursal del contexto activo.
- El cambio de contexto (`/api/auth/context`) valida pertenencia por `SucursalMiembro`.
- Las APIs tenant-scoped deben usar el tenant resuelto en servidor, no un `restauranteId` arbitrario del cliente.

## 5.2 Membresías y roles

Creación/actualización de membresías en flujos principales:

- Registro (`/api/auth/register`)
- Invitaciones (`/api/auth/invites/accept`)
- Códigos de acceso (`/api/auth/access-codes/redeem`)
- Alta de sucursal (`/api/auth/branches`)
- OAuth sign-in (`auth.ts`)

Comportamiento actual en OAuth:

- Si la membresía ya existe, solo reactiva (`activo: true`) y no pisa `rolId` existente.
- Si crea membresía nueva, inicializa `rolId` desde el usuario en ese contexto.

## 6. Menú multisucursal

Modelo actual en `Restaurante`:

- `menuStrategy`: `EMPTY` | `CLONE` | `SHARED`
- `menuSourceRestauranteId`

Resolución:

- `getMenuContext(restauranteId)` devuelve `menuRestauranteId` efectivo.

Regla de escritura:

- Sucursales consumidoras de `SHARED` no pueden editar carta (409).

Alineación reciente:

- `GET /api/public/menu/[slug]` usa `getMenuContext` para leer menú efectivo (evita divergencia con dashboard en SHARED).

## 7. Endpoints clave de auth/tenancy

- `GET /api/auth/me`
- `GET /api/auth/tenancy`
- `POST /api/auth/context`
- `GET /api/auth/memberships`
- `POST/DELETE /api/auth/branches`
- `POST/PATCH/DELETE /api/auth/organization`
- `POST /api/auth/access-codes/redeem`
- `POST /api/auth/invites/accept`

## 8. Seguridad

### 8.1 Capas

- Autenticación por middleware + NextAuth.
- Autorización fina en handlers (`tienePermiso`).
- Validación de payload con Zod.
- Hash de secretos/tokens (códigos, API keys, etc. según flujo).

### 8.2 Riesgos controlados y deuda conocida

- Riesgo mitigado: rol por sucursal ya soportado en membresías.
- Riesgo residual: `Usuario.rolId` sigue existiendo como compatibilidad y puede inducir ambigüedad en flujos legacy si no se migra totalmente.

## 9. Checklist de validación manual

Flujos mínimos para QA:

1. Usuario con 2 sucursales y roles distintos:
   - cambiar contexto
   - confirmar que autorización responde al rol de la sucursal activa
2. OAuth login de usuario multi-sucursal:
   - confirmar que no sobreescribe `rolId` de membresía existente
3. Listado de membresías:
   - validar que el rol mostrado viene de membresía (`SucursalMiembro`/`OrganizacionMiembro`)
4. Menú público de sucursal SHARED:
   - validar que renderiza carta de fuente

## 10. Próximos pasos recomendados

1. Migrar UI/admin para gestionar rol por sucursal explícitamente.
2. Reducir dependencia de `Usuario.rolId` hasta deprecación.
3. Unificar guardas de autorización tenant/resource-scoped para todas las mutaciones.

---

Última actualización: 2026-04-07
