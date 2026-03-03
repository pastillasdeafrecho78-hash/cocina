# Exponer la Aplicación a Internet para Usar con Smartphone

## 🚀 Opciones para Exponer la App

### Opción 1: ngrok (Recomendado para desarrollo rápido)

**ngrok** es la forma más rápida de exponer tu aplicación local a internet.

#### Instalación:

1. **Descargar ngrok:**
   - Ve a https://ngrok.com/download
   - Descarga para Windows
   - Extrae el archivo `ngrok.exe`

2. **Registrarse (gratis - REQUERIDO):**
   - Crea una cuenta en https://dashboard.ngrok.com/signup
   - Es completamente gratis y solo toma 1 minuto
   - Obtén tu authtoken en: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Configurar el authtoken:**
   
   **Opción A - En .env.local (recomendado):**
   ```env
   # Agrega esta línea a .env.local
   NGROK_AUTHTOKEN=tu_token_aqui
   ```
   
   **Opción B - Globalmente (si instalaste ngrok.exe):**
   ```bash
   ngrok config add-authtoken TU_AUTHTOKEN_AQUI
   ```

4. **Iniciar tu aplicación Next.js (en una terminal):**
   ```bash
   npm run dev
   ```
   Tu app estará en `http://localhost:3000`
   Espera a que diga "Ready" antes de continuar

5. **Exponer con ngrok (en otra terminal):**
   
   **Opción A - Usando el script incluido (recomendado):**
   ```bash
   npm run tunnel
   ```
   Este script verifica automáticamente que tengas el authtoken configurado.
   
   **Opción B - Usando npx directamente:**
   ```bash
   npm run tunnel:simple
   ```
   Requiere que hayas configurado el authtoken en .env.local
   
   **Opción C - Si instalaste ngrok.exe globalmente:**
   ```bash
   ngrok http 3000
   ```
   Requiere que hayas ejecutado `ngrok config add-authtoken` primero

6. **Obtener la URL pública:**
   - ngrok mostrará una URL como: `https://abc123.ngrok-free.app`
   - Esta URL es accesible desde cualquier dispositivo con internet
   - **Importante:** Esta URL cambia cada vez que reinicias ngrok (a menos que uses plan de pago)
   - Copia esta URL y úsala en tu smartphone

#### Ventajas:
- ✅ Muy rápido de configurar
- ✅ HTTPS automático (necesario para sensores)
- ✅ Gratis para uso básico
- ✅ Funciona inmediatamente

#### Desventajas:
- ❌ URL cambia en cada reinicio (plan gratuito)
- ❌ Límite de conexiones simultáneas (plan gratuito)

---

### Opción 2: Cloudflare Tunnel (Gratis y permanente)

**Cloudflare Tunnel** ofrece URLs permanentes y gratuitas.

#### Instalación:

1. **Instalar cloudflared:**
   ```bash
   # Windows (con Chocolatey)
   choco install cloudflared
   
   # O descargar desde: https://github.com/cloudflare/cloudflared/releases
   ```

2. **Autenticarse:**
   ```bash
   cloudflared tunnel login
   ```

3. **Crear un túnel:**
   ```bash
   cloudflared tunnel create mi-restaurante
   ```

4. **Configurar el túnel:**
   - Crea un archivo `config.yml` en `C:\Users\TU_USUARIO\.cloudflared\config.yml`:
   ```yaml
   tunnel: TU_TUNNEL_ID
   credentials-file: C:\Users\TU_USUARIO\.cloudflared\TU_TUNNEL_ID.json
   
   ingress:
     - hostname: mi-restaurante.tu-dominio.com
       service: http://localhost:3000
     - service: http_status:404
   ```

5. **Ejecutar el túnel:**
   ```bash
   cloudflared tunnel run mi-restaurante
   ```

#### Ventajas:
- ✅ URL permanente
- ✅ Completamente gratis
- ✅ HTTPS automático
- ✅ Sin límites de conexiones

---

### Opción 3: Vercel (Recomendado para producción)

**Vercel** es la plataforma oficial de Next.js y es perfecta para producción.

#### Pasos:

1. **Instalar Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Iniciar sesión:**
   ```bash
   vercel login
   ```

3. **Desplegar:**
   ```bash
   vercel
   ```

4. **Seguir las instrucciones:**
   - Vercel te dará una URL permanente
   - Ejemplo: `https://mi-restaurante.vercel.app`

#### Ventajas:
- ✅ URL permanente
- ✅ HTTPS automático
- ✅ Optimizado para Next.js
- ✅ Deploy automático con Git
- ✅ Plan gratuito generoso

---

### Opción 4: Railway / Render (Alternativas)

**Railway** y **Render** también ofrecen hosting gratuito:

#### Railway:
```bash
# Instalar CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway init
railway up
```

#### Render:
- Ve a https://render.com
- Conecta tu repositorio Git
- Selecciona "Web Service"
- Render despliega automáticamente

---

## 🔒 Configuración de HTTPS (Importante)

Los sensores del dispositivo **REQUIEREN HTTPS** para funcionar. Todas las opciones anteriores ya incluyen HTTPS automático.

Si usas una solución personalizada, asegúrate de:
1. Configurar un certificado SSL válido
2. Redirigir HTTP a HTTPS
3. Usar puerto 443 para HTTPS

---

## 📱 Acceso desde Smartphone

Una vez que tengas la URL pública:

1. **Abre el navegador en tu smartphone**
2. **Ve a la URL** (ej: `https://abc123.ngrok-free.app`)
3. **Inicia sesión** en la aplicación
4. **Ve a Dashboard → Mesas → Mapear Cuarto**
5. **La aplicación solicitará permisos automáticamente:**
   - 📍 Geolocalización
   - 📱 Sensores de movimiento
   - 🧭 Sensores de orientación

---

## ⚙️ Configuración Adicional

### Variables de Entorno

Si usas ngrok o un túnel, puedes configurar opcionalmente:

```env
# .env.local
# Opcional: Token de autenticación de ngrok (para URLs permanentes)
NGROK_AUTHTOKEN=tu_token_aqui

# Opcional: URL pública si necesitas referenciarla en el código
NEXT_PUBLIC_API_URL=https://tu-url-publica.com
```

**Nota:** El token de ngrok es opcional. Sin él, ngrok funcionará pero con URLs temporales.

### CORS (si es necesario)

Si tienes problemas de CORS, configura `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}
```

---

## 🧪 Probar los Permisos

1. **Abre la app en tu smartphone**
2. **Ve a la página de mapeo**
3. **Verifica que aparezca el diálogo de permisos:**
   - El navegador pedirá permiso para geolocalización
   - Los sensores se activarán automáticamente (puede requerir gesto del usuario en iOS)

4. **Si no aparecen los permisos:**
   - Verifica que estés usando HTTPS
   - Intenta mover el teléfono (iOS requiere gesto)
   - Recarga la página
   - Verifica la consola del navegador para errores

---

## 🐛 Solución de Problemas

### Los sensores no funcionan:
- ✅ Verifica que estés usando HTTPS
- ✅ Asegúrate de haber concedido permisos
- ✅ En iOS, mueve el teléfono después de solicitar permisos
- ✅ Verifica que el navegador soporte los sensores (Chrome/Edge recomendado)

### No puedo acceder desde el smartphone:
- ✅ Verifica que la URL sea correcta
- ✅ Asegúrate de que ngrok/túnel esté corriendo
- ✅ Verifica que no haya firewall bloqueando
- ✅ Prueba desde otra red (datos móviles vs WiFi)

### Los permisos no se solicitan:
- ✅ Verifica la consola del navegador
- ✅ Asegúrate de estar en HTTPS
- ✅ Intenta en modo incógnito
- ✅ Limpia la caché del navegador

---

## 📝 Recomendación Final

**Para desarrollo rápido:** Usa **ngrok**
**Para producción:** Usa **Vercel** o **Railway**

Ambas opciones son gratuitas y funcionan perfectamente con los sensores del dispositivo.
