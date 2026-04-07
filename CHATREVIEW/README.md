# Propuesta de Arquitectura V2 (CHATREVIEW)

Documento maestro para evolucionar la app de "funcional" a "robusta y escalable" sin romper onboarding ni flujos actuales.

## 1) Diagnóstico arquitectónico

1. La base multitenant existe y funciona: `Organizacion`, `Restaurante`, `SucursalMiembro`, `OrganizacionMiembro` ya modelan pertenencia.
2. La app usa bien `activeRestauranteId` y `activeOrganizacionId` para contexto de trabajo, pero convive con `Usuario.restauranteId` como legado.
3. `Usuario.rolId` como rol "global de fila" es el mayor punto de ambigüedad: no representa rol por sucursal.
4. El esquema actual permite duplicar identidad por email entre sucursales (`@@unique([restauranteId, email])`), lo cual complica auditoria y OAuth.
5. `Rol.permisos` en JSON agilizo evolucion, pero deja deuda de tipado, validacion y consistencia entre handlers.
6. `middleware.ts` autentica correctamente, pero no garantiza autorizacion por capacidad/recurso; eso depende del rigor de cada API.
7. `MenuStrategy` (`EMPTY`, `CLONE`, `SHARED`) resolvio un primer paso de multisucursal, pero `SHARED` es acoplamiento total de carta.
8. La separacion lectura/escritura para SHARED (lectura desde fuente, escritura 409 en consumidor) es correcta y debe preservarse.
9. El onboarding por codigo y membresias es una fortaleza; hay que protegerlo como restriccion de migracion.
10. Falta una "fuente de verdad unica" para identidad, membresia, rol y tenant operativo; hoy esta repartida entre usuario, membresias y sesion.

## 2) Fuente de verdad recomendada

### Definiciones

- Identidad del usuario: una sola fila por persona.
- Membresia: pertenencia del usuario a organizacion/sucursal.
- Rol: asignacion de permisos por alcance (organizacion o sucursal).
- Contexto activo: preferencia de UI y sesion.
- Tenant operativo: sucursal efectiva para ejecutar APIs.
- Tenant fuente de menu: sucursal dueña del catalogo base.

| Concepto | Tabla/campo recomendado | Por que | Campo actual a deprecar |
|---|---|---|---|
| Identidad de usuario | `Usuario.id` + `Usuario.email @unique` global | Evita duplicados por sucursal y simplifica OAuth | `@@unique([restauranteId, email])` |
| Membresia organizacion | `OrganizacionMiembro(usuarioId, organizacionId, activo)` | Separa pertenencia de identidad | N/A (mantener y endurecer constraints) |
| Membresia sucursal | `SucursalMiembro(usuarioId, restauranteId, activo)` | Fuente de verdad de acceso operativo | `Usuario.restauranteId` como acceso |
| Rol por sucursal | `SucursalMiembro.rolId` (nuevo) | Permite permisos distintos por sucursal | `Usuario.rolId` como unico rol |
| Rol por organizacion (opcional) | `OrganizacionMiembro.rolId` (nuevo) | Admin cross-branch sin replicar permisos | Uso ad-hoc de `esOwner` para todo |
| Contexto activo | `Usuario.activeRestauranteId`, `Usuario.activeOrganizacionId` | Ya existe y funciona con JWT | N/A (mantener) |
| Tenant operativo | Resolver siempre desde `activeRestauranteId` validado contra `SucursalMiembro` | Elimina ambiguedad runtime | Fallback opaco a `Usuario.restauranteId` |
| Tenant fuente de menu | `Restaurante.menuSourceRestauranteId` + nuevo grafo de asignaciones | Mantiene propiedad del catalogo | `SHARED` como unico mecanismo |

## 3) Propuesta de modelo de datos V2

### Tablas/campos nuevos

1. **`SucursalMiembro.rolId String?`** (FK a `Rol`): rol por sucursal.
2. **`OrganizacionMiembro.rolId String?`** (FK a `Rol`, opcional): rol de alcance organizacion.
3. **`MenuCatalogItem`**: catalogo base versionable (producto/categoria/modificador "canonico").
4. **`MenuAssignment`**: asignacion de item canonico a sucursal destino.
5. **`MenuOverride`**: overrides por sucursal (`precio`, `disponible`, `activo`, `orden`, etc.).
6. **`MenuSourceLink`** (si se quiere separar de `Restaurante`): relacion fuente-destino y modo.

### Campos legacy a mantener temporalmente

- `Usuario.rolId`: solo compatibilidad.
- `Usuario.restauranteId`: solo compatibilidad y backfill.
- `Restaurante.menuStrategy`: compatibilidad mientras se migra a asignaciones.

### Constraints e indices recomendados

- `Usuario.email` -> `@unique`.
- `SucursalMiembro` -> `@@unique([usuarioId, restauranteId])`.
- `OrganizacionMiembro` -> `@@unique([usuarioId, organizacionId])`.
- `MenuAssignment` -> `@@unique([restauranteId, menuCatalogItemId])`.
- `MenuOverride` -> `@@unique([restauranteId, menuCatalogItemId])`.
- FKs con `onDelete: Restrict` en relaciones criticas de auditoria; `SetNull` solo para campos de conveniencia.

### Relaciones nuevas/modificadas

- `SucursalMiembro.rol -> Rol`.
- `OrganizacionMiembro.rol -> Rol`.
- `MenuAssignment.menuCatalogItem -> MenuCatalogItem`.
- `MenuAssignment.restaurante -> Restaurante`.
- `MenuOverride.menuAssignment` o `(restauranteId, menuCatalogItemId)` directo.

## 4) Propuesta para permisos por sucursal

### Modelo recomendado

- Evaluar permisos desde `SucursalMiembro.rolId` de la sucursal activa.
- Mantener `Rol.permisos` como payload durante transicion, pero mover fuente de asignacion del rol al miembro, no al usuario.

### Evaluacion runtime

1. Resolver `tenantOperativo` desde `activeRestauranteId`.
2. Cargar `SucursalMiembro` activo del usuario para ese tenant.
3. Tomar `rolId` del miembro.
4. Resolver permisos (`legacy + capacidades`) con helper central.
5. Validar capacidad y ownership de recurso en handler.

### Convivencia temporal con `Rol.permisos`

- `tienePermiso()` primero intenta `SucursalMiembro.rol`.
- Si no existe (fase transitoria), cae en `Usuario.rol`.
- Registrar metricas/log para detectar rutas aun en fallback.

### Evitar ruptura del sistema actual

- No eliminar `Usuario.rolId` en primeras fases.
- Backfill inicial: `SucursalMiembro.rolId = Usuario.rolId` para membresias activas.
- Feature flag: `AUTHZ_V2_BRANCH_ROLE`.

## 5) Propuesta para menu multisucursal V2

### Objetivo funcional

Pasar de "shared total por sucursal" a "catalogo base + asignacion parcial + overrides locales".

### Tablas necesarias

- `MenuCatalogItem` (canonico por fuente).
- `MenuAssignment` (que items del canonico aplican a cada sucursal).
- `MenuOverride` (precio/disponibilidad/activacion por sucursal).
- Mantener tablas actuales (`Categoria`, `Producto`, `Modificador`) como almacenamiento operativo mientras se migra.

### Reglas de lectura

1. Resolver sucursal activa.
2. Resolver fuente base (si aplica).
3. Obtener asignaciones activas (`MenuAssignment`).
4. Aplicar `MenuOverride`.
5. Mezclar con items locales permitidos de la sucursal (si modo hibrido).
6. Exponer un "menu efectivo" unico para dashboard y API publica.

### Reglas de escritura

- Escritura sobre catalogo base: solo rol con `menu.manage` en sucursal fuente.
- Escritura sobre overrides: `menu.manage` en sucursal destino.
- En modo heredado SHARED: mantener 409 en escritura directa de consumidor.

### Que hacer con `CLONE` y `SHARED`

- `CLONE`: mantener como accion explicita "desacoplar y copiar snapshot".
- `SHARED`: evolucionar semantica a "HEREDADO" (misma idea, mas granular con asignaciones).

### Riesgos operativos

- Cambios masivos no intencionales en fuente -> mitigado con aprobacion y auditoria.
- Divergencia dashboard vs API publica -> mitigado con servicio unico de lectura de menu efectivo.
- Performance por joins extra -> mitigado con materializacion/cache por sucursal.

## 6) Riesgos de seguridad/autorizacion

| Riesgo | Ejemplo tipico | Impacto | Mitigacion recomendada | Prioridad |
|---|---|---|---|---|
| Sesion sin permiso | Handler solo valida `getSessionUser()` | Escalada horizontal interna | Guard estandar `requireCapability()` en todas las mutaciones | Alta |
| Tenant mal resuelto | Mutacion aplicada en sucursal no activa | Corrupcion de datos entre sucursales | `requireTenantMembership(activeRestauranteId)` + scoping obligatorio | Alta |
| IDOR tenant-scoped | Aceptar `restauranteId` del cliente sin validar membresia | Exfiltracion/modificacion cross-tenant | Ignorar tenant de entrada y derivar del contexto servidor | Alta |
| Escritura indebida en menu compartido | Consumidor SHARED modifica fuente | Cambio global accidental | Bloqueo 409 + chequeo de fuente en DB | Alta |
| Roles legacy ambiguos | `Usuario.rolId` no representa sucursal | Privilegios inconsistentes | Migrar a `SucursalMiembro.rolId` con fallback controlado | Alta |
| Claves/tokens filtrados | API keys o codigos en logs | Toma de cuenta/integracion | Hash + redaccion de logs + rotacion | Media |
| JWT desalineado | Cambio de membresia y token viejo vigente | Autorizacion stale temporal | Versionado de sesion y revalidacion en server | Media |
| RLS asumido como control total | Confiar en RLS cuando Prisma usa rol privilegiado | Falsa sensacion de seguridad | Mantener autorizacion en aplicacion | Media |

## 7) Plan de migracion por fases

### Fase 0: compatibilidad

- **Objetivo:** preparar estructuras sin cambiar comportamiento.
- **Cambios:** agregar columnas `rolId` en membresias, nuevos indices, tablas de menu V2 vacias.
- **Riesgos:** migraciones bloqueantes.
- **Rollback/guardrails:** migraciones idempotentes, `NOT VALID` constraints y activacion gradual.

### Fase 1: introducir nuevas fuentes de verdad

- **Objetivo:** poblar datos V2.
- **Cambios:** backfill `SucursalMiembro.rolId`, normalizar `Usuario.email`, poblar `MenuAssignment` base.
- **Riesgos:** datos huerfanos o duplicados.
- **Rollback/guardrails:** scripts de validacion previa/post, tablas de auditoria de backfill.

### Fase 2: migrar lecturas

- **Objetivo:** leer permisos y menu desde V2 con fallback.
- **Cambios:** helpers `resolveBranchRole()`, `getEffectiveMenu()`.
- **Riesgos:** respuestas inconsistentes entre endpoints.
- **Rollback/guardrails:** feature flags por modulo (`AUTHZ_V2_READ`, `MENU_V2_READ`).

### Fase 3: migrar escrituras

- **Objetivo:** mutaciones apuntan a V2.
- **Cambios:** handlers de carta/permisos escriben en tablas nuevas y legacy segun estrategia dual-write.
- **Riesgos:** drift entre legacy y V2.
- **Rollback/guardrails:** dual-write con comparacion y alertas, posibilidad de volver a single-write legacy.

### Fase 4: deprecacion

- **Objetivo:** retirar dependencias funcionales de campos legacy.
- **Cambios:** dejar `Usuario.rolId` y `Usuario.restauranteId` en solo lectura interna.
- **Riesgos:** endpoints olvidados.
- **Rollback/guardrails:** reporte de uso de campos legacy en runtime/logs.

### Fase 5: limpieza final

- **Objetivo:** simplificar modelo definitivo.
- **Cambios:** eliminar fallback, constraints finales, documentacion final.
- **Riesgos:** ruptura tardia por integraciones externas.
- **Rollback/guardrails:** ventana de observacion + plan de restauracion de columnas con snapshots.

## 8) Checklist tecnico ejecutable

- [ ] Crear migracion para `SucursalMiembro.rolId` y `OrganizacionMiembro.rolId` - archivo probable: `prisma/schema.prisma` + `prisma/migrations/*` - riesgo: medio
- [ ] Añadir `@unique` global en `Usuario.email` con plan de deduplicacion - archivo probable: `prisma/schema.prisma` - riesgo: alto
- [ ] Implementar helper `resolveBranchMembershipAndRole()` - archivo probable: `lib/auth-server.ts` - riesgo: medio
- [ ] Implementar guard reutilizable `requireCapability(cap, tenant)` - archivo probable: `lib/permisos.ts` - riesgo: medio
- [ ] Refactor de handlers de carta para usar guard estandar - archivo probable: `app/api/categorias/*`, `app/api/productos/*`, `app/api/modificadores/*` - riesgo: alto
- [ ] Crear servicio unico `getEffectiveMenu()` - archivo probable: `lib/menu-context.ts` o nuevo `lib/menu-effective.ts` - riesgo: alto
- [ ] Alinear API publica de menu con lectura efectiva V2 - archivo probable: `app/api/public/menu/[slug]/route.ts` - riesgo: alto
- [ ] Introducir tablas `MenuCatalogItem`, `MenuAssignment`, `MenuOverride` - archivo probable: `prisma/schema.prisma` - riesgo: alto
- [ ] Instrumentar feature flags de authz/menu - archivo probable: `lib/flags.ts`, `lib/permisos.ts`, handlers API - riesgo: medio
- [ ] Agregar pruebas de autorizacion cross-tenant - archivo probable: `tests/api/*` (o suite existente) - riesgo: medio
- [ ] Agregar auditoria de mutaciones de menu fuente y overrides - archivo probable: `app/api/*` + modelo de auditoria - riesgo: medio
- [ ] Actualizar docs operativas de onboarding y roles - archivo probable: `CHATREVIEW/*` - riesgo: bajo

## 9) Decision recomendada final

Tomaria esta decision: **mover la autoridad de permisos al nivel de membresia por sucursal (`SucursalMiembro.rolId`) y evolucionar menu compartido a un modelo de asignaciones + overrides**, manteniendo compatibilidad por fases con `Usuario.rolId`, `Usuario.restauranteId` y `MenuStrategy`.

Evitaria:

- Reescribir todo de golpe (big bang).
- Apostar a que middleware resuelva autorizacion fina.
- Mantener indefinidamente JSON de permisos sin estrategia de validacion.

No intentaria resolver todavia:

- Un ABAC completo por recurso/campo.
- Un motor de politicas externo.
- Un rediseño total de dominio de producto fuera de tenancy/authz/menu.

Primero cerraria consistencia de dominio, scoping de tenant y permisos por sucursal; eso es lo que mas reduce riesgo productivo y tecnico.

---

## Anexos

- [01-producto.md](./01-producto.md)
- [02-tenancy-onboarding.md](./02-tenancy-onboarding.md)
- [03-permisos.md](./03-permisos.md)
- [04-carta-menu-strategy.md](./04-carta-menu-strategy.md)
- [05-modulos-api.md](./05-modulos-api.md)
- [06-publico-integraciones.md](./06-publico-integraciones.md)
- [07-tecnico-stack.md](./07-tecnico-stack.md)
- [08-datos-prisma.md](./08-datos-prisma.md)
- [09-seguridad.md](./09-seguridad.md)
