# Stack y decisiones de refactor

## Stack actual (se mantiene)

- Next.js App Router + TypeScript.
- Route Handlers en `app/api/**`.
- Prisma + PostgreSQL.
- NextAuth JWT.

No se propone cambiar stack. La evolucion es de **modelo de dominio y autorizacion**, no de framework.

## Componentes tecnicos a introducir

1. Capa de guards unificada (`lib/authz.ts` o similar).
2. Resolver de menu efectivo (`lib/menu-effective.ts`).
3. Feature flags para migracion gradual.
4. Jobs/scripts de backfill y validacion de consistencia.

## Fases tecnicas de implementacion

### Fase 0 (compatibilidad)
- Migraciones aditivas.
- Sin cambiar flujos de negocio.

### Fase 1 (fuentes V2)
- Backfill de `SucursalMiembro.rolId`.
- Poblado de tablas de menu V2.

### Fase 2 (lecturas V2)
- Permisos leidos desde miembro de sucursal (con fallback).
- Menu leido desde resolvedor efectivo.

### Fase 3 (escrituras V2)
- Dual-write controlado en menu/permisos.
- Validaciones de drift.

### Fase 4 (deprecacion)
- `Usuario.rolId` y `Usuario.restauranteId` pasan a compatibilidad.

### Fase 5 (limpieza)
- Retiro de fallback y constraints finales.

## Guardrails de operacion

- Feature flags por modulo.
- Telemetria de fallback legacy.
- Auditoria de mutaciones sensibles.
- Rollback por fase, nunca big bang.
