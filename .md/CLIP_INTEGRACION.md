# Integración Clip (PinPad)

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `PUBLIC_BACKEND_BASE_URL` | URL pública base para webhooks de Clip (ej. `https://api.tu-dominio.com`). |
| `CLIP_API_BASE` | Opcional. Por defecto `https://api.payclip.io`. |
| `ENCRYPTION_KEY` | Hex 64 chars — misma clave que encripta Conekta/PAC; necesaria para guardar API key Clip. |

## Webhook en Clip

Registra la URL:

`{PUBLIC_BACKEND_BASE_URL}/api/webhooks/clip/{slug}`

Ejemplo: `https://app.ejemplo.com/api/webhooks/clip/principal`

Si configuraste **secreto webhook** en Caja → Clip, cada POST debe incluir el header:

`x-clip-webhook-secret: <mismo valor en texto plano que guardaste>`

## API interna

- `GET/PATCH /api/clip/config` — credenciales (permiso caja)
- `GET/POST /api/clip/terminales` — registrar número de serie
- `DELETE /api/clip/terminales/[id]` — desactivar
- `POST /api/clip/crear-intencion` — `{ comandaId, serialNumber, tipAmount? }`
- `GET /api/clip/dispositivos` — proxy estado dispositivos Clip
- `GET /api/clip/estado?pagoId=&pinpadRequestId=` — polling si el webhook no llega

## Contrato mínimo para pruebas (plug-and-play)

Para empezar a cobrar con Clip, solo se requiere:

1. API key de Clip (Caja → Clip)
2. Número de serie de la terminal (`serialNumber`)
3. Comanda lista para cobro (`comandaId`)

No es necesario configurar PAC, CSD, Conekta ni datos fiscales para validar el cobro con terminal.

## Corte Z / fiscal

Los pagos Clip (`tarjeta_clip`, procesador `clip`) se cuentan como **tarjeta** en el reporte de caja. Al completarse (webhook o polling) se marca comanda `PAGADO` y se libera mesa. El timbrado fiscal queda opcional y no bloquea el cobro.
