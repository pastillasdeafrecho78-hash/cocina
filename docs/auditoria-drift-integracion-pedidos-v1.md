# Auditoría de drift: prototipo externo vs ServimOS canónico

## Resumen ejecutivo

- ServimOS ya tiene backend canónico para pedidos externos en `app/api/public/integraciones/pedidos/*`.
- El dominio oficial está en `Comanda` y `ComandaItem` (no se requieren tablas paralelas).
- Se confirma unicidad idempotente base en `Comanda` por `@@unique([restauranteId, externalOrderId])`.

## Inventario de drift detectado

### Reutilizable

- Contrato de headers requeridos para integración externa.
- Catálogo de errores canónicos con `code`.
- Patrón de reintento idempotente con respuesta `idempotent: true`.

### Adaptable

- Guard de tenant scope para distinguir:
  - `invalid_api_key` (key inválida),
  - `branch_scope_mismatch` (key válida pero de otra sucursal).
- Extracción de lógica a `lib/orders/*` para evitar duplicación entre POST y GET.

### Descartable

- Cualquier backend paralelo (p. ej. Fastify independiente) como dueño de dominio.
- Migraciones Prisma externas al árbol de ServimOS sin revisión explícita.

## Decisión de arquitectura

- Mantener un solo backend canónico (ServimOS).
- Segunda app consume HTTP únicamente.
- Toda escritura de órdenes externas termina en `Comanda`/`ComandaItem`.

## Riesgos evitados

- Divergencia de reglas de negocio entre servicios.
- Desalineación de migraciones Prisma entre proyectos.
- Inconsistencias de tenant routing y estado de órdenes.
