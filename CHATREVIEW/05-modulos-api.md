# APIs y patron de autorizacion recomendado

## Patrón objetivo para todo `app/api/**`

Cada handler tenant-scoped debe ejecutar siempre esta secuencia:

1. `requireAuthenticatedUser()`
2. `resolveTenantContext()` desde sesion
3. `requireTenantMembership(usuarioId, tenant)`
4. `requireCapability(capacidad, tenant)`
5. `requireResourceScope(recurso, tenant)` cuando hay IDs en path/body

Sin excepciones para mutaciones.

## Hotspots donde suelen aparecer huecos

- Endpoints que solo verifican sesion y luego hacen query por ID sin validar pertenencia.
- Endpoints que aceptan `restauranteId` del cliente y lo usan directo.
- Endpoints de menu que resuelven lectura diferente entre dashboard y canal publico.
- Endpoints de configuracion destructiva sin doble confirmacion ni auditoria.

## Aplicacion concreta por modulo

| Modulo | Patrón recomendado |
|---|---|
| `app/api/auth/*` | Mantener publico solo lo estrictamente necesario; todo cambio de contexto valida membresia |
| `app/api/roles/*` | Gestion de roles con `staff.manage` y scoping por tenant |
| `app/api/categorias/*` `app/api/productos/*` `app/api/modificadores/*` | Lectura desde menu efectivo; mutacion bloqueada si herencia no editable |
| `app/api/public/*` | Sin sesion, pero con validaciones de tenant/publicacion/estado equivalentes |

## Refactor recomendado de codigo

- Crear guardas reutilizables en `lib` y prohibir autorizacion ad-hoc en handlers.
- Reducir logica repetida con wrappers (`withTenantGuard`, `withCapability`).
- Estandarizar respuestas de error (`401`, `403`, `404`, `409`) por caso.

## Resultado esperado

Menos drift entre endpoints, menos riesgo cross-tenant y menor costo de incorporar modulos nuevos.
