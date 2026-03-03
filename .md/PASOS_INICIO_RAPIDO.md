# 🚀 Pasos para Iniciar el Sistema

## ✅ Pasos Completados

1. ✅ PostgreSQL configurado en pgAdmin 4
2. ✅ `.env.local` configurado con DATABASE_URL y JWT_SECRET
3. ✅ Cliente Prisma generado
4. ✅ Migraciones aplicadas (tablas creadas)
5. ✅ Base de datos poblada con datos iniciales

## 🎯 Siguiente Paso: Iniciar el Servidor

### Opción 1: PowerShell (Recomendado)
```powershell
cd "C:\Users\Salvador Barba (TD)\Desktop\Cocina shit"
npm run dev
```

### Opción 2: Terminal Integrado
```bash
npm run dev
```

El servidor iniciará en: **http://localhost:3000**

---

## 🔑 Credenciales de Acceso

### Admin (Configuración completa del sistema)
- **Email:** `admin@restaurante.com`
- **Password:** `admin123`

### Mesero (Crear y gestionar comandas)
- **Email:** `mesero@restaurante.com`
- **Password:** `mesero123`

### Cocinero (Ver pedidos de cocina)
- **Email:** `cocinero@restaurante.com`
- **Password:** `cocinero123`

---

## 📋 Lo que Puedes Hacer Ahora

### 1. Iniciar Sesión como Admin
1. Abre: http://localhost:3000/login
2. Usa: `admin@restaurante.com` / `admin123`
3. Verás el **Dashboard Admin** con todas las funciones

### 2. Configurar el Restaurante (Primera Vez)
1. Ve a **Configuración** en el menú
2. Completa el wizard de 4 pasos:
   - **Paso 1:** Datos Fiscales (RFC, domicilio, etc.)
   - **Paso 2:** PAC - Facturación.com (API Key)
   - **Paso 3:** Conekta - Pagos (Private/Public Keys)
   - **Paso 4:** Certificado de Sello Digital (CSD)
3. Guarda la configuración

### 3. Usar el Sistema
- **Mesas:** Ver y gestionar mesas
- **Comandas:** Crear y ver comandas
- **Cocina:** Ver pedidos pendientes
- **Barra:** Ver pedidos de bebidas

---

## ⚠️ Notas Importantes

### Configuración Inicial
- **No necesitas** configurar Facturación.com o Conekta para empezar
- Puedes usar el sistema de comandas sin facturación/pagos
- La facturación y pagos se habilitan cuando configures el wizard

### Base de Datos
- Ya tienes 12 mesas creadas
- Ya tienes productos de ejemplo
- Puedes agregar más desde la UI (cuando esté implementado)

### Desarrollo vs Producción
- Ahora estás en **modo desarrollo**
- Para producción, necesitarás:
  - Configurar facturación con datos reales
  - Configurar pagos con keys de producción
  - Configurar certificado CSD del SAT

---

## 🆘 Si Algo No Funciona

### Error: "Cannot connect to database"
- Verifica que PostgreSQL esté corriendo
- Verifica que `DATABASE_URL` en `.env.local` sea correcta
- Verifica que la base de datos `comandas_db` exista

### Error: "Port 3000 already in use"
```bash
# Cambiar puerto
npm run dev -- -p 3001
```

### Error: "Module not found"
```bash
# Reinstalar dependencias
npm install
```

---

## 📝 Comandos Útiles

```bash
# Generar cliente Prisma (si cambias el schema)
npm run db:generate

# Ver base de datos en Prisma Studio
npm run db:studio

# Ejecutar migraciones
npm run db:migrate

# Poblar datos iniciales
npm run db:seed
```

---

## 🎉 ¡Listo!

Ya puedes iniciar el servidor y comenzar a usar el sistema de comandas.

**Ejecuta:** `npm run dev` y ve a http://localhost:3000
