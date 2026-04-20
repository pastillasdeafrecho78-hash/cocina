# Checklist de rollout — pedidos cliente, ocupación y cola

## Feature flags por sucursal (`ConfiguracionRestaurante`)

- `pedidosClienteSolicitudHabilitado`: habilita flujo de solicitud cliente.
- `modoDPedidosHabilitado` (en base de datos): control automático de carga para pedidos por link/QR (comandas activas + ítems en preparación, cola, mensajes). En la API pública del panel se expone como `controlCargaAutomaticaPedidos`.
- `queueEnabled`: permite cola (`EN_COLA`) cuando hay saturación.
- `qrMesaEnabled`: permite generación y validación de QR por mesa.
- `autoAprobarSolicitudes`: auto-promueve solicitudes cuando hay capacidad.
- `maxComandasActivas`: umbral de saturación.
- `tiempoEsperaSaturacionMin` y `mensajeSaturacion`: copy y tiempo al cliente.

## Flujo recomendado de despliegue

1. Aplicar migración `20260420133000_modo_d_policy_queue` (nombre histórico del archivo SQL; el comportamiento es el de control de ocupación).
2. Activar flags en una sola sucursal piloto.
3. Ejecutar promoción manual de cola con `POST /api/solicitudes/promover-cola`.
4. Monitorear bitácora de solicitudes/comandas y colaboración de meseros.
5. Expandir al resto de sucursales por lotes.

## Casos E2E mínimos

- Solicitud cliente con capacidad disponible -> `PENDIENTE` (o autoaprobada según flag).
- Solicitud en saturación sin aceptar cola -> rechazo con `restaurant_saturated`.
- Solicitud en saturación aceptando cola -> `EN_COLA`.
- Override manual:
  - aprobar,
  - rechazar,
  - forzar,
  - saltar cola.
- Promoción de cola con slots disponibles.
- QR de mesa deshabilitado por flag -> respuesta 403.
- Entrega por mesero distinto al asignado -> registro `ComandaColaborador` + historial.

## Verificación de seguridad

- `orders.override` solo para roles autorizados.
- Operaciones de comanda/solicitud siempre scopeadas por `restauranteId`.
- Respeto de horario por `SucursalMiembro` al crear comandas manuales.
