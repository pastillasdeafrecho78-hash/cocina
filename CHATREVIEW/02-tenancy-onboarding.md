# Tenancy y onboarding: fuente de verdad

## Estado actual resumido

- `Usuario` guarda `rolId`, `restauranteId`, `activeRestauranteId`, `activeOrganizacionId`.
- `SucursalMiembro` y `OrganizacionMiembro` modelan pertenencia real.
- El contexto activo se refleja en JWT y en APIs de tenancy.

Funciona, pero mezcla legado (`Usuario.restauranteId`) con modelo multitenant moderno.

## Fuente de verdad objetivo (V2)

| Concepto | Recomendacion | Motivo | Legacy a deprecar |
|---|---|---|---|
| Identidad | `Usuario` con email global unico | Una persona = una cuenta | `@@unique([restauranteId, email])` |
| Pertenencia sucursal | `SucursalMiembro` | Acceso real por tenant operativo | `Usuario.restauranteId` como acceso |
| Pertenencia organizacion | `OrganizacionMiembro` | Gobierno cross-sucursal | Uso implicito de `esOwner` para todo |
| Rol por tenant | `SucursalMiembro.rolId` | Permisos distintos por sucursal | `Usuario.rolId` como asignacion unica |
| Contexto activo | `Usuario.activeRestauranteId` y `activeOrganizacionId` | Ya soportado por UI/JWT | N/A |
| Tenant operativo | Derivado del `activeRestauranteId` validado | Evita errores cross-tenant | Fallback ambiguo a `Usuario.restauranteId` |

## Reglas de dominio recomendadas

1. Ninguna API tenant-scoped acepta `restauranteId` del cliente como verdad.
2. El tenant operativo siempre se deriva de sesion + membresia activa valida.
3. El onboarding solo crea/activa membresias; no duplica identidad.
4. Cambios de contexto (`/api/auth/context`) validan membresia activa de forma estricta.

## Onboarding sin ruptura

Mantener los flujos actuales y endurecerlos:

- Codigo de vinculacion hasheado, one-time, con expiracion.
- Alta por invitacion/codigo crea `SucursalMiembro` (y `OrganizacionMiembro` cuando aplica).
- Si no hay membresia operativa, redireccion controlada a `/acceso`.

## Deprecaciones planificadas

- `Usuario.restauranteId`: mantener solo para compatibilidad temporal y backfill.
- `Usuario.rolId`: mantener como fallback hasta completar migracion de permisos por sucursal.
