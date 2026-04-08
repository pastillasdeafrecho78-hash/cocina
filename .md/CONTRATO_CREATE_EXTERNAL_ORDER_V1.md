# Contrato API V1: CreateExternalOrder (Second App -> Main Backend)

Version: `v1`  
Estado: Contract-first, listo para implementar  
Owner: Backend Platform

## 1. Objetivo del contrato

Permitir que la segunda app cree pedidos en la app principal de forma segura, idempotente y tenant-scoped por sucursal, sin acceso directo a base de datos.

## 2. Endpoint

- Metodo: `POST`
- URL recomendada v1: `/api/public/integraciones/pedidos/orders`
- Auth: API key de integracion por sucursal

## 3. Headers requeridos

- `x-api-key`: credencial de app/sucursal.
- `x-restaurante-slug`: slug de sucursal destino.
- `x-idempotency-key`: clave unica por intento logico de pedido.
- `content-type: application/json`

Headers opcionales:

- `x-api-version: v1`
- `x-correlation-id`: trazabilidad distribuida.

## 4. Reglas de autenticacion y scope

1) `x-api-key` debe existir y estar activa.  
2) Key debe pertenecer a la sucursal referida por `x-restaurante-slug`.  
3) Si la key no matchea tenant: `403 branch_scope_mismatch`.  
4) Si sucursal inactiva/suspendida: `409 branch_inactive` o `branch_suspended`.

## 5. Request schema (canonical)

```json
{
  "externalOrderId": "ext-2026-04-08-000123",
  "tipoPedido": "DELIVERY",
  "canal": "EXTERNAL_APP",
  "catalogVersion": "2026-04-08T00:00:00Z",
  "cliente": {
    "nombre": "Juan Perez",
    "telefono": "+525512345678",
    "direccion": "Calle 1 #123"
  },
  "notas": "Sin cebolla",
  "items": [
    {
      "productoId": "cuid_producto_1",
      "tamanoId": "cuid_tamano_1",
      "cantidad": 2,
      "notas": "Poco picante",
      "modificadores": [
        {
          "modificadorId": "cuid_mod_1"
        }
      ]
    }
  ],
  "deliveryMetadata": {
    "mode": "OWN_FLEET",
    "driverRef": "DRV-11",
    "vehicleNote": "Moto azul"
  }
}
```

## 5.1 Validaciones de request

- `externalOrderId`: requerido, max 80 chars, unico por sucursal.
- `tipoPedido`: enum permitido (`LOCAL`, `DOMICILIO`, `DELIVERY`, segun dominio activo).
- `canal`: para este flujo `EXTERNAL_APP`.
- `items`: minimo 1 item.
- `cantidad`: entero positivo.
- `productoId`, `tamanoId`, `modificadorId`: deben pertenecer al scope de catalogo efectivo.
- `catalogVersion`: opcional pero recomendado para control de stale metadata.

## 6. Semantica de idempotencia

Clave: `x-idempotency-key`.

Reglas:

1) Misma key + mismo tenant + mismo payload -> respuesta idempotente con `idempotent=true`.  
2) Misma key + mismo tenant + payload distinto -> `409 idempotency_payload_mismatch`.  
3) Timeout cliente con duda de resultado -> reintentar con la misma key.

Persistencia recomendada:

- Tabla `ExternalIdempotencyKey` (o equivalente):
  - key,
  - restauranteId,
  - payloadHash,
  - status,
  - responseSnapshot,
  - createdAt,
  - expiresAt.

TTL recomendado: 24h-72h.

## 7. Response success schema

HTTP `201` (nuevo) o `200` (idempotente recuperado)

```json
{
  "success": true,
  "data": {
    "orderId": "cuid_comanda",
    "numeroComanda": 731,
    "restauranteId": "cuid_restaurante",
    "restauranteSlug": "sucursal-centro",
    "estado": "PENDIENTE",
    "origen": "EXTERNAL_API",
    "idempotent": false,
    "createdAt": "2026-04-08T03:10:00.000Z"
  }
}
```

Caso idempotente recuperado:

```json
{
  "success": true,
  "data": {
    "orderId": "cuid_comanda",
    "numeroComanda": 731,
    "restauranteId": "cuid_restaurante",
    "restauranteSlug": "sucursal-centro",
    "estado": "PENDIENTE",
    "origen": "EXTERNAL_API",
    "idempotent": true,
    "createdAt": "2026-04-08T03:10:00.000Z"
  }
}
```

## 8. Errores canónicos (v1)

Formato uniforme:

```json
{
  "success": false,
  "error": "mensaje legible",
  "code": "codigo_canonico",
  "details": {}
}
```

Matriz de errores:

- `400 invalid_payload` -> esquema invalido.
- `401 invalid_api_key` -> key ausente o invalida.
- `403 branch_scope_mismatch` -> key no autorizada para slug.
- `404 branch_not_found` -> slug no existe.
- `409 branch_inactive` -> sucursal inactiva.
- `409 idempotency_payload_mismatch` -> misma key, payload diferente.
- `409 duplicate_external_order` -> `externalOrderId` ya existe (si aplica).
- `409 catalog_version_mismatch` -> cliente usa catalogo obsoleto.
- `422 invalid_item_scope` -> producto/tamano/modificador fuera de sucursal/catálogo efectivo.
- `429 rate_limited` -> exceso por key/IP.
- `500 internal_error` -> fallback.

## 9. Reglas de consistencia de dominio

1) Creacion de comanda e items en transaccion unica.  
2) Si un item/modificador falla validacion, no se persiste nada.  
3) `origen` debe quedar en `EXTERNAL_API`/`EXTERNAL_APP` consistente con contrato.  
4) `externalOrderId` debe quedar indexado con unicidad por `restauranteId`.

## 10. Tenant routing invariants

Invariantes obligatorios:

- Toda entidad creada por este endpoint debe tener `restauranteId` exactamente igual al tenant resuelto por key+slug.
- Nunca aceptar referencias de items de otro tenant.
- Auditoria debe registrar:
  - keyId/integracionId,
  - restauranteId resuelto,
  - correlationId,
  - resultado.

## 11. Endpoint complementario de estado (recomendado)

- `GET /api/public/integraciones/pedidos/orders/:orderId`
- Mismo auth M2M por key/scope
- Devuelve estado resumido para polling de segunda app:
  - `PENDIENTE`, `EN_PREPARACION`, `LISTO`, `SERVIDO`, `PAGADO`, `CANCELADO`.

## 12. Ejemplo de secuencia cliente (segunda app)

1) Construir payload y `x-idempotency-key`.  
2) Ejecutar POST.  
3) Si timeout/red:
   - reintentar misma key.
4) Si `catalog_version_mismatch`:
   - sincronizar catalogo y reintentar con nueva key.
5) Polling de estado hasta estado terminal.

## 13. QA contract checklist

- [ ] Key valida + slug valido crea pedido.
- [ ] Key de otra sucursal rechaza con `branch_scope_mismatch`.
- [ ] Reintento misma key no duplica pedido.
- [ ] Misma key distinto payload falla con `idempotency_payload_mismatch`.
- [ ] Item cross-tenant falla con `invalid_item_scope`.
- [ ] Sucursal inactiva devuelve `branch_inactive`.
- [ ] Estructura de error siempre incluye `code`.
