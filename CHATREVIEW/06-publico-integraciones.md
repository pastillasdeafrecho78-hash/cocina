# Canal publico e integraciones (alineado a V2)

## Regla principal

El hecho de que `/api/public/*` sea publico no significa "sin reglas". Debe compartir las mismas reglas de scoping de menu y estado de sucursal que el dashboard.

## Menu publico

Problema tipico actual: el canal publico puede leer carta distinta a la del dashboard si no usa el mismo resolvedor de menu efectivo.

Decision V2:

- Dashboard y API publica llaman al mismo servicio (`getEffectiveMenu()`).
- La sucursal publica puede heredar menu parcial y overrides igual que staff.
- Si una sucursal esta inactiva, el canal publico responde estado controlado (no filtra datos internos).

## Pedidos por link publico

- Mantener origen `PUBLIC_LINK`.
- Mantener token hasheado y comparar en tiempo constante.
- Aplicar rate limiting por IP + recurso.
- Validar que el pedido pertenezca a la sucursal efectiva del link.

## Integracion API externa

- Mantener `IntegracionPedidosApi` con API key hasheada.
- Exigir `externalOrderId` idempotente por sucursal.
- Registrar auditoria de reintentos y rechazos por duplicado.

## Controles recomendados adicionales

1. Rotacion de API keys con overlap temporal.
2. Redaccion de secretos en logs.
3. Firma de webhook/eventos cuando aplique.
4. Catalogo de errores estable para integradores.
