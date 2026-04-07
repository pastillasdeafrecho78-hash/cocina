# Permisos por sucursal (V2)

## Problema actual

La evaluacion de permisos existe (`lib/permisos.ts`), pero la asignacion del rol esta en `Usuario.rolId`. Eso impide modelar que un usuario sea admin en una sucursal y operador en otra.

## Modelo recomendado

1. `Rol` se mantiene como definicion de permisos (`legacy + capacidades`).
2. La asignacion del rol se mueve a `SucursalMiembro.rolId`.
3. `Usuario.rolId` queda como fallback temporal de compatibilidad.

## Flujo de evaluacion runtime

1. Resolver tenant operativo desde contexto activo.
2. Cargar `SucursalMiembro` activo para `(usuarioId, restauranteId)`.
3. Tomar `rolId` de ese miembro.
4. Resolver permisos con la matriz legacy/granular actual.
5. Validar capacidad + ownership de recurso en el handler.

## Convivencia temporal sin romper produccion

- Paso 1: backfill `SucursalMiembro.rolId = Usuario.rolId`.
- Paso 2: `tienePermiso()` intenta `SucursalMiembro.rol` y luego fallback a `Usuario.rol`.
- Paso 3: observabilidad de fallback (logs/metrica) para detectar deuda restante.
- Paso 4: remover fallback cuando no haya trafico legacy.

## Reglas minimas por tipo de API

| Tipo de endpoint | Regla minima |
|---|---|
| Lectura tenant-scoped | Sesion + membresia activa del tenant |
| Mutacion tenant-scoped | Sesion + membresia activa + capacidad (`*.manage`) |
| Acciones destructivas | Capacidad + doble confirmacion + auditoria |
| Cross-tenant admin | Rol organizacion o owner explicito, nunca implicito |

## Recomendacion de implementacion

Crear guardas reutilizables:

- `requireTenantMembership()`
- `requireCapability()`
- `requireResourceScope()`

Con eso se evita que cada `route.ts` reimplemente autorizacion de forma inconsistente.
