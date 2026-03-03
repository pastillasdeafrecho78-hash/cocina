# 🔧 Guía de Configuración de Variables de Entorno

Esta guía te ayudará a configurar todas las variables de entorno necesarias para el sistema de comandas con facturación y pagos.

## 📋 Paso a Paso

### Paso 1: Variables de Base de Datos (Ya configuradas)

Si ya tienes estas configuradas, puedes saltar este paso.

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/comandas_db"
```

**Instrucciones**:
- Reemplaza `TU_PASSWORD` con tu contraseña de PostgreSQL
- Si usas un usuario diferente a `postgres`, cámbialo también
- Si tu base de datos tiene otro nombre, cámbialo

---

### Paso 2: Autenticación JWT (Ya configurada)

Si ya tienes JWT_SECRET configurado, puedes saltar este paso.

**Generar JWT_SECRET** (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

O usar: https://generate-secret.vercel.app/32

```env
JWT_SECRET="PEGA_AQUI_EL_SECRETO_GENERADO"
```

---

### Paso 3: Configuración del PAC (Facturación.com)

**3.1. Crear cuenta en Facturación.com**

1. Ve a: https://facturacion.com
2. Crea una cuenta (puedes usar plan de prueba primero)
3. Una vez dentro, ve a "API" o "Desarrolladores"
4. Genera tu API Key

**3.2. Agregar variables al .env.local**

```env
# PAC - Facturación.com
PAC_API_KEY="tu_api_key_de_facturacion_com"
PAC_API_URL="https://api.facturacion.com/v1"
PAC_MODO="produccion"  # o "pruebas" para desarrollo
```

**Nota**: Para desarrollo, puedes usar `PAC_MODO="pruebas"` que permite facturar sin costo real.

---

### Paso 4: Configuración de Conekta (Procesador de Pagos)

**4.1. Crear cuenta en Conekta**

1. Ve a: https://conekta.com
2. Crea una cuenta
3. Ve a "Configuración" > "API Keys"
4. Copia tu **Private Key** (la que empieza con `key_`)

**4.2. Agregar variables al .env.local**

```env
# Procesador de Pagos - Conekta
CONEKTA_PRIVATE_KEY="key_tu_private_key_aqui"
CONEKTA_PUBLIC_KEY="key_tu_public_key_aqui"
CONEKTA_API_VERSION="2.0"
```

**Nota**: 
- **Private Key**: Se usa en el backend (nunca exponer en frontend)
- **Public Key**: Se usa en el frontend para tokenizar tarjetas
- Para desarrollo, usa las keys de "Pruebas" (sandbox)

---

### Paso 5: Datos Fiscales del Restaurante

**5.1. Información que necesitas**

Necesitas tener a la mano:
- RFC del restaurante
- Nombre o razón social
- Régimen fiscal (código del SAT)
- Domicilio fiscal completo
- Certificado de Sello Digital (CSD) - archivo .cer y .key

**5.2. Obtener Certificado de Sello Digital (CSD)**

Si no lo tienes:

1. Ve a: https://www.sat.gob.mx
2. Inicia sesión con tu RFC y contraseña
3. Ve a "Obtener Certificado de Sello Digital"
4. Descarga el certificado (.cer) y la llave privada (.key)
5. Guarda estos archivos de forma segura

**5.3. Agregar variables al .env.local**

```env
# Datos Fiscales del Restaurante
RESTAURANTE_RFC="ABC123456789"
RESTAURANTE_NOMBRE="RESTAURANTE EJEMPLO S.A. DE C.V."
RESTAURANTE_REGIMEN_FISCAL="601"
RESTAURANTE_CODIGO_POSTAL="01000"
RESTAURANTE_CALLE="Av. Ejemplo"
RESTAURANTE_NUMERO_EXTERIOR="123"
RESTAURANTE_NUMERO_INTERIOR=""  # Opcional
RESTAURANTE_COLONIA="Colonia Ejemplo"
RESTAURANTE_MUNICIPIO="Ciudad de México"
RESTAURANTE_ESTADO="Ciudad de México"
RESTAURANTE_PAIS="MEX"

# Certificado de Sello Digital (CSD)
# Ruta a los archivos del certificado (relativa a la raíz del proyecto)
CSD_CER_PATH="./certificados/restaurante.cer"
CSD_KEY_PATH="./certificados/restaurante.key"
CSD_PASSWORD="password_del_certificado"  # Contraseña del archivo .key
```

**⚠️ IMPORTANTE**:
- Crea una carpeta `certificados/` en la raíz del proyecto
- Coloca ahí tus archivos .cer y .key
- Agrega `certificados/` al `.gitignore` para no subir los certificados
- La contraseña del .key es la que configuraste al descargar el certificado

---

### Paso 6: Configuración de Webhooks

**6.1. Webhook de Conekta**

Necesitarás configurar un webhook en Conekta para recibir notificaciones de pagos.

```env
# Webhooks
WEBHOOK_SECRET_CONEKTA="tu_webhook_secret_de_conekta"
WEBHOOK_URL="http://localhost:3000/api/webhooks/conekta"  # Para desarrollo
# En producción: "https://tu-dominio.com/api/webhooks/conekta"
```

**Configurar en Conekta**:
1. Ve a Conekta > Configuración > Webhooks
2. Agrega una URL de webhook
3. Copia el "Webhook Secret" que te dan

---

### Paso 7: Configuración General

```env
# Aplicación
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Para desarrollo
# En producción: "https://tu-dominio.com"

# Ambiente
NODE_ENV="development"  # o "production" en producción
```

---

## 📝 Archivo .env.local Completo

Una vez que tengas toda la información, tu archivo `.env.local` debería verse así:

```env
# ============================================
# BASE DE DATOS
# ============================================
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/comandas_db"

# ============================================
# AUTENTICACIÓN
# ============================================
JWT_SECRET="tu_jwt_secret_aqui"

# ============================================
# PAC - FACTURACIÓN ELECTRÓNICA
# ============================================
PAC_API_KEY="tu_api_key_de_facturacion_com"
PAC_API_URL="https://api.facturacion.com/v1"
PAC_MODO="pruebas"  # "pruebas" o "produccion"

# ============================================
# PROCESADOR DE PAGOS - CONEKTA
# ============================================
CONEKTA_PRIVATE_KEY="key_tu_private_key_aqui"
CONEKTA_PUBLIC_KEY="key_tu_public_key_aqui"
CONEKTA_API_VERSION="2.0"

# ============================================
# DATOS FISCALES DEL RESTAURANTE
# ============================================
RESTAURANTE_RFC="ABC123456789"
RESTAURANTE_NOMBRE="RESTAURANTE EJEMPLO S.A. DE C.V."
RESTAURANTE_REGIMEN_FISCAL="601"
RESTAURANTE_CODIGO_POSTAL="01000"
RESTAURANTE_CALLE="Av. Ejemplo"
RESTAURANTE_NUMERO_EXTERIOR="123"
RESTAURANTE_NUMERO_INTERIOR=""
RESTAURANTE_COLONIA="Colonia Ejemplo"
RESTAURANTE_MUNICIPIO="Ciudad de México"
RESTAURANTE_ESTADO="Ciudad de México"
RESTAURANTE_PAIS="MEX"

# ============================================
# CERTIFICADO DE SELLO DIGITAL (CSD)
# ============================================
CSD_CER_PATH="./certificados/restaurante.cer"
CSD_KEY_PATH="./certificados/restaurante.key"
CSD_PASSWORD="password_del_certificado"

# ============================================
# WEBHOOKS
# ============================================
WEBHOOK_SECRET_CONEKTA="tu_webhook_secret"
WEBHOOK_URL="http://localhost:3000/api/webhooks/conekta"

# ============================================
# APLICACIÓN
# ============================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

---

## ✅ Checklist de Configuración

Marca cada paso cuando lo completes:

- [ ] **Base de Datos**: DATABASE_URL configurado
- [ ] **JWT**: JWT_SECRET generado y configurado
- [ ] **PAC**: Cuenta creada en Facturación.com y API_KEY obtenida
- [ ] **Conekta**: Cuenta creada y keys (private/public) obtenidas
- [ ] **Datos Fiscales**: RFC, nombre, régimen y domicilio completos
- [ ] **CSD**: Certificado descargado del SAT y guardado en `certificados/`
- [ ] **Webhooks**: Webhook configurado en Conekta (opcional para desarrollo)
- [ ] **Variables**: Todas las variables agregadas al `.env.local`

---

## 🔒 Seguridad

**IMPORTANTE**:
- ✅ El archivo `.env.local` ya está en `.gitignore` (no se subirá a git)
- ✅ **NUNCA** subas tus certificados (.cer, .key) a git
- ✅ **NUNCA** compartas tus API keys públicamente
- ✅ Usa keys de "Pruebas" durante desarrollo
- ✅ Cambia a keys de "Producción" solo cuando estés listo

---

## 🆘 Problemas Comunes

### Error: "API Key inválida"
- Verifica que copiaste la key completa (sin espacios)
- Asegúrate de usar la key correcta (pruebas vs producción)

### Error: "Certificado no encontrado"
- Verifica las rutas en `CSD_CER_PATH` y `CSD_KEY_PATH`
- Asegúrate de que los archivos estén en la carpeta `certificados/`
- Verifica que los nombres de archivo coincidan exactamente

### Error: "Contraseña del certificado incorrecta"
- La contraseña es la que configuraste al descargar el CSD del SAT
- Si no la recuerdas, tendrás que descargar un nuevo certificado

---

## 📞 Siguiente Paso

Una vez que tengas todo configurado, avísame y comenzaré a construir el proyecto con:
1. Servicios de facturación
2. Servicios de pagos
3. Integración con PAC
4. Integración con Conekta
5. Endpoints de API
6. Componentes de UI

¡Vamos paso a paso! 🚀
