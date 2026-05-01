# Contrato API Mesas Para App Movil

## Objetivo

Definir el contrato estable que Android/iOS deben usar para consumir y operar mesas por sucursal activa.

Este contrato usa siempre el tenant activo del usuario autenticado. La app movil no debe enviar `restauranteId` para decidir scope operativo; debe cambiar de sucursal con el flujo de autenticacion/contexto y despues consumir `/api/mesas`.

## Principio Multi-Tenant

- La frontera del dominio es `restauranteId` activo.
- `Mesa.numero` es unico por sucursal: `restauranteId + numero`.
- La misma `Mesa 1` puede existir en sucursales distintas.
- Una `Mesa 1` duplicada dentro de la misma sucursal debe fallar con `409`.
- Ningun endpoint debe operar mesas de otra sucursal aunque el cliente envie IDs manualmente.

## Autenticacion

Todos los endpoints privados requieren sesion valida.

Si no hay sesion:

```json
{
  "success": false,
  "error": "No autenticado"
}
```

Status esperado: `401`.

## Permisos

Lectura de mesas:

- `tables.view`
- `mesas`
- `comandas`
- `reportes`
- `caja`

Crear, borrar y editar layout de mesas:

- `tables.manage`
- `mesas`

Cambiar estado operativo de mesa:

- `tables.manage`
- `mesas`
- `orders.manage`

Links/QR por mesa:

- `tables.client_channel`
- `mesas`

## GET /api/mesas

Lista las mesas activas de la sucursal activa.

Permisos:

- ver seccion anterior, lectura de mesas.

Respuesta `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "mesa_id",
      "restauranteId": "sucursal_id",
      "numero": 1,
      "estado": "LIBRE",
      "capacidad": 4,
      "ubicacion": "Interior",
      "piso": "1",
      "posicionX": 100,
      "posicionY": 150,
      "rotacion": 0,
      "forma": "RECTANGULAR",
      "ancho": 1.25,
      "alto": 1,
      "activa": true,
      "hasPublicLink": false,
      "comandaActual": null
    }
  ]
}
```

Cuando hay comanda activa:

```json
{
  "comandaActual": {
    "numeroComanda": "COM-260430-0001",
    "total": 350,
    "fechaCreacion": "2026-04-30T18:00:00.000Z",
    "totalItems": 4,
    "itemsEntregados": 2,
    "allItemsEntregados": false,
    "waitStartFrom": "2026-04-30T18:05:00.000Z",
    "asignadoA": {
      "id": "usuario_id",
      "nombre": "Nombre",
      "apellido": "Apellido"
    }
  }
}
```

Notas para movil:

- `posicionX`, `posicionY`, `rotacion`, `forma`, `ancho`, `alto` son para vista plano.
- Si faltan dimensiones, normalizar como `RECTANGULAR`, `ancho=1`, `alto=1`.
- `waitStartFrom` puede ser `null`; si existe, usarlo para timers de espera de items pendientes.
- `hasPublicLink` solo indica si existe link activo; para obtener el codigo se usa endpoint de public-link.

## POST /api/mesas

Crea una mesa en la sucursal activa.

Permisos:

- `tables.manage`
- `mesas`

Body:

```json
{
  "numero": 12,
  "capacidad": 4,
  "ubicacion": "Terraza",
  "piso": "2",
  "forma": "RECTANGULAR",
  "ancho": 1.5,
  "alto": 1
}
```

Campos:

- `numero`: entero positivo, requerido.
- `capacidad`: entero positivo, requerido.
- `ubicacion`: string opcional.
- `piso`: string opcional.
- `forma`: `RECTANGULAR` o `CIRCULAR`, opcional.
- `ancho`: numero entre `0.75` y `6`, opcional.
- `alto`: numero entre `0.75` y `6`, opcional. En circular se iguala a `ancho`.

Respuesta `200`:

```json
{
  "success": true,
  "data": {
    "id": "mesa_id",
    "restauranteId": "sucursal_id",
    "numero": 12,
    "capacidad": 4,
    "ubicacion": "Terraza",
    "piso": "2",
    "estado": "LIBRE",
    "activa": true
  }
}
```

Conflicto `409`:

```json
{
  "success": false,
  "error": "Ya existe una mesa 12 en esta sucursal"
}
```

## PATCH /api/mesas/:id

Actualiza estado operativo o layout de una mesa de la sucursal activa.

Permisos:

- Para solo `estado`: `tables.manage`, `mesas` u `orders.manage`.
- Para layout/plano: `tables.manage` o `mesas`.

Body estado:

```json
{
  "estado": "RESERVADA"
}
```

Body layout:

```json
{
  "piso": "Terraza",
  "posicionX": 250,
  "posicionY": 400,
  "rotacion": 90,
  "forma": "CIRCULAR",
  "ancho": 1.25,
  "alto": 1.25
}
```

Validaciones:

- `estado`: `LIBRE`, `OCUPADA`, `CUENTA_PEDIDA`, `RESERVADA`.
- `posicionX`, `posicionY`: `0` a `10000`.
- `rotacion`: `0` a `360`.
- `forma`: `RECTANGULAR` o `CIRCULAR`.
- `ancho`, `alto`: `0.75` a `6`.

Respuesta `200`:

```json
{
  "success": true,
  "data": {
    "id": "mesa_id",
    "numero": 12,
    "estado": "RESERVADA"
  }
}
```

No encontrada o fuera de tenant `404`:

```json
{
  "success": false,
  "error": "Mesa no encontrada"
}
```

## DELETE /api/mesas/:id

Desactiva una mesa de la sucursal activa.

Permisos:

- `tables.manage`
- `mesas`

Regla:

- Si la mesa tiene comanda activa, devuelve `400`.
- El borrado es soft delete: `activa=false`.

Respuesta `200`:

```json
{
  "success": true
}
```

Con comanda activa `400`:

```json
{
  "success": false,
  "error": "No se puede borrar: la mesa tiene una comanda activa. Cierra o cancela la comanda primero."
}
```

## GET /api/mesas/:id/public-link

Obtiene informacion del link/QR publico de una mesa.

Permisos:

- `tables.client_channel`
- `mesas`

Respuesta sin link:

```json
{
  "success": true,
  "data": {
    "hasLink": false,
    "mesaNumero": 12,
    "restauranteSlug": "sucursal"
  }
}
```

Respuesta con link:

```json
{
  "success": true,
  "data": {
    "hasLink": true,
    "mesaNumero": 12,
    "restauranteSlug": "sucursal",
    "publicCode": "codigo_publico",
    "activa": true,
    "updatedAt": "2026-04-30T18:00:00.000Z"
  }
}
```

La URL cliente se arma como:

```text
/p/{restauranteSlug}?mesa={publicCode}
```

## POST /api/mesas/:id/public-link

Genera o regenera link/QR publico de una mesa.

Permisos:

- `tables.client_channel`
- `mesas`

Si `qrMesaEnabled=false`, devuelve `403`.

Respuesta `200`:

```json
{
  "success": true,
  "data": {
    "mesaId": "mesa_id",
    "mesaNumero": 12,
    "mesaCode": "codigo_publico",
    "restauranteSlug": "sucursal"
  }
}
```

## Estados De Mesa

- `LIBRE`: mesa disponible.
- `OCUPADA`: mesa con uso activo.
- `CUENTA_PEDIDA`: mesa esperando cierre/cobro.
- `RESERVADA`: mesa apartada.

## Reglas De UI Movil

- Usar `GET /api/mesas` como fuente principal.
- No cachear mesas entre sucursales sin llave por `restauranteId`.
- Al cambiar sucursal, invalidar cache local y volver a pedir `/api/mesas`.
- La app puede ocultar botones segun permisos, pero debe asumir que el backend es la autoridad final.
- Para vista plano, encuadrar por bounding box de mesas activas con margen.
- Para vista lista, ordenar por `numero` y agrupar por `piso` si existe.

## Errores Comunes

`400`:

- Body invalido.
- Datos fuera de rango.
- Intento de borrar mesa con comanda activa.

`401`:

- No autenticado.

`403`:

- Sin permisos.
- QR por mesa deshabilitado.

`404`:

- Mesa no encontrada.
- Mesa pertenece a otra sucursal.

`409`:

- Numero duplicado en la misma sucursal.
- Restriccion de base o conflicto operativo.

`500`:

- Error no esperado. Debe revisarse en logs de Vercel.

## Criterios De Compatibilidad Para Android/iOS

- No depender de campos no documentados.
- Tratar fechas como UTC ISO.
- Soportar `null` en campos opcionales.
- Reintentar lectura tras cambio de sucursal.
- Mostrar mensajes de error del backend cuando existan.
