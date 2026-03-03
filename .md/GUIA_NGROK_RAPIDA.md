# 🚀 Guía Rápida: Configurar ngrok en 2 minutos

## Paso 1: Crear cuenta y obtener token (1 minuto)

1. Ve a https://dashboard.ngrok.com/signup
2. Crea una cuenta (es gratis, solo email)
3. Una vez dentro, ve a: https://dashboard.ngrok.com/get-started/your-authtoken
4. Copia tu authtoken (algo como: `2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5`)

## Paso 2: Configurar el token (30 segundos)

Abre el archivo `.env.local` y agrega:

```env
NGROK_AUTHTOKEN=tu_token_copiado_aqui
```

**Ejemplo:**
```env
NGROK_AUTHTOKEN=2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5
```

Guarda el archivo.

## Paso 3: Usar ngrok (30 segundos)

### Terminal 1 - Inicia tu app:
```bash
npm run dev
```

### Terminal 2 - Inicia ngrok:
```bash
npm run tunnel:simple
```

Verás algo como:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

## Paso 4: Usar en tu smartphone

1. Copia la URL de ngrok (ej: `https://abc123.ngrok-free.app`)
2. Ábrela en el navegador de tu smartphone
3. ¡Listo! La app solicitará permisos automáticamente

---

## ❓ Problemas Comunes

### "authentication failed"
- ✅ Verifica que agregaste `NGROK_AUTHTOKEN` a `.env.local`
- ✅ Asegúrate de que el token esté correcto (sin espacios)
- ✅ Reinicia la terminal después de agregar el token

### "port 3000 is already in use"
- ✅ Asegúrate de que `npm run dev` esté corriendo
- ✅ Si no, cambia el puerto: `npm run dev -- -p 3001` y luego `ngrok http 3001`

### La URL no funciona en el smartphone
- ✅ Verifica que ngrok esté corriendo
- ✅ Asegúrate de usar HTTPS (no HTTP)
- ✅ Verifica que tu PC y smartphone estén en la misma red o que ngrok esté activo

---

## 💡 Tips

- La URL cambia cada vez que reinicias ngrok (plan gratuito)
- Para URL permanente, necesitas un plan de pago de ngrok
- Alternativa gratis permanente: Usa Cloudflare Tunnel (ver EXPOSICION_INTERNET.md)
