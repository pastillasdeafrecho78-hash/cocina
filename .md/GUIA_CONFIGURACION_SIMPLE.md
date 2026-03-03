# 🚀 Guía de Configuración Simple - Sistema de Comandas

## ✅ Configuración Mínima para Empezar

Solo necesitas **2 variables** en tu `.env.local` para que la aplicación funcione:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/comandas_db"
JWT_SECRET="tu_jwt_secret_generado"
```

**¡Eso es todo!** El resto se configura desde la UI cuando el admin inicia sesión por primera vez.

---

## 📋 Paso 1: Configurar .env.local

### 1.1 Base de Datos

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/comandas_db"
```

- Reemplaza `TU_PASSWORD` con tu contraseña de PostgreSQL
- Si usas otro usuario o base de datos, ajusta la URL

### 1.2 JWT Secret

**Generar JWT_SECRET** (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

O usar: https://generate-secret.vercel.app/32

```env
JWT_SECRET="PEGA_AQUI_EL_SECRETO_GENERADO"
```

---

## 🎯 Paso 2: Iniciar la Aplicación

Una vez configurado el `.env.local`:

```bash
# 1. Verificar configuración
npm run verify:env

# 2. Generar cliente Prisma
npm run db:generate

# 3. Ejecutar migraciones
npm run db:migrate

# 4. Poblar datos iniciales
npm run db:seed

# 5. Iniciar servidor
npm run dev
```

---

## 🔧 Paso 3: Configuración desde la UI (Primera Vez)

Cuando el admin inicia sesión por primera vez, verá un **wizard de configuración** donde podrá configurar:

### 3.1 Datos Fiscales del Restaurante
- RFC
- Nombre o Razón Social
- Régimen Fiscal
- Domicilio Fiscal completo

### 3.2 Certificado de Sello Digital (CSD)
- Subir archivos .cer y .key
- Ingresar contraseña del certificado
- Validar que esté vigente

### 3.3 Integración con PAC (Facturación)
- API Key de Facturación.com
- Modo (Pruebas/Producción)

### 3.4 Integración con Procesador de Pagos
- API Keys de Conekta
- Configurar webhooks (opcional)

**Todo esto se guarda en la base de datos**, no en variables de entorno.

---

## 📝 Archivo .env.local Completo (Mínimo)

```env
# ============================================
# CONFIGURACIÓN MÍNIMA REQUERIDA
# ============================================
# Solo estas dos variables son necesarias para empezar

# Base de datos PostgreSQL
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/comandas_db"

# Autenticación JWT
JWT_SECRET="tu_jwt_secret_aqui"
```

---

## ✅ Checklist de Inicio Rápido

- [ ] PostgreSQL instalado y corriendo
- [ ] Base de datos `comandas_db` creada
- [ ] `.env.local` creado con `DATABASE_URL` y `JWT_SECRET`
- [ ] `npm run verify:env` muestra todo correcto
- [ ] `npm run db:migrate` ejecutado
- [ ] `npm run db:seed` ejecutado
- [ ] `npm run dev` inicia sin errores
- [ ] Puedes iniciar sesión con: `admin@restaurante.com` / `admin123`

---

## 🎉 ¡Listo para Usar!

Una vez completado el checklist, puedes:

1. **Iniciar sesión** como admin
2. **Configurar el restaurante** desde la UI (wizard de primera vez)
3. **Comenzar a usar** el sistema de comandas

**No necesitas configurar nada más en `.env.local`** - todo se hace desde la aplicación.

---

## 🔒 Seguridad

- ✅ El `.env.local` ya está en `.gitignore`
- ✅ Los certificados se suben desde la UI y se almacenan de forma segura
- ✅ Las API keys se encriptan antes de guardarse en la base de datos
- ✅ Solo el admin puede ver/modificar la configuración

---

## 🆘 ¿Problemas?

### Error: "DATABASE_URL not found"
- Verifica que el archivo se llame exactamente `.env.local`
- Verifica que esté en la raíz del proyecto
- Verifica que no tenga espacios extra alrededor del `=`

### Error: "JWT_SECRET too short"
- Genera uno nuevo con el comando de PowerShell o el generador online
- Asegúrate de que tenga al menos 32 caracteres

### Error: "Cannot connect to database"
- Verifica que PostgreSQL esté corriendo
- Verifica que la contraseña en `DATABASE_URL` sea correcta
- Verifica que la base de datos `comandas_db` exista

---

**¡Listo!** Con solo estas 2 variables puedes empezar a usar el sistema. 🚀
