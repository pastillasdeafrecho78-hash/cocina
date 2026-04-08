# Verificación MCP Supabase (solo lectura) - Integración de pedidos v1

## Proyecto consultado

- `project_id`: `rpfvkclmwdxrmetrlien`
- `name`: `ServimOS`

## Herramientas MCP usadas

1. `list_projects`
2. `list_tables` (`schemas: ["public"]`, `verbose: false/true`)
3. `execute_sql` (consulta de índices en `Comanda`, `ComandaItem`, `IntegracionPedidosApi`)

## Confirmaciones de esquema

- Existen tablas canónicas:
  - `public.Comanda`
  - `public.ComandaItem`
  - `public.IntegracionPedidosApi`
- Índice único de idempotencia por tenant confirmado:
  - `Comanda_restauranteId_externalOrderId_key`
  - Definición: `UNIQUE (restauranteId, externalOrderId)`
- Índice único de configuración por sucursal confirmado:
  - `IntegracionPedidosApi_restauranteId_key`

## Observaciones relevantes

- `IntegracionPedidosApi` aparece con `rows: 0` en el entorno consultado.
  - Implicación: cualquier flujo real de POST externo requerirá crear/configurar integración por sucursal.
- Se observan dos índices únicos sobre número de comanda:
  - `Comanda_numeroComanda_key` (global)
  - `Comanda_restauranteId_numeroComanda_key` (por sucursal)
  - No bloquea este vertical slice, pero conviene revisar si ambos son intencionales para evitar restricciones innecesarias.

## Diferencias vs expectativa de handoff

- No hay drift de tablas core para integración v1.
- La unicidad `restauranteId + externalOrderId` está presente en la base real.
- La principal brecha operativa es de datos/configuración (`IntegracionPedidosApi` sin registros), no de estructura.
