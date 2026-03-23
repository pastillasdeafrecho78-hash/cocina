# Integración Clip (PinPad)

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_APP_URL` | URL pública base para el webhook (ej. `https://tu-dominio.com`). En local, túnel (ngrok) o dejar vacío y usar polling desde caja. |
| `VERCEL_URL` | En Vercel se usa automáticamente si no hay `NEXT_PUBLIC_APP_URL`. |
| `CLIP_API_BASE` | Opcional. Por defecto `https://api.payclip.io`. |
| `ENCRYPTION_KEY` | Hex 64 chars — misma clave que encripta Conekta/PAC; necesaria para guardar API key Clip. |

## Webhook en Clip

Registra la URL:

`{NEXT_PUBLIC_APP_URL}/api/webhooks/clip/{slug}`

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

## Corte Z / fiscal

Los pagos Clip (`tarjeta_clip`, procesador `clip`) se cuentan como **tarjeta** en el reporte de caja. Al completarse (webhook o polling) se marca comanda `PAGADO`, se libera mesa y se intenta timbrar **factura global** si el PAC está configurado.
