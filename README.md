# Sistema de Comandas para Restaurantes

Sistema de gestión de comandas diseñado para restaurantes, bares y cocinas que necesitan orden, velocidad y eliminación de papelitos/gritos a cocina.

## 🚀 Características

- **Mapa de Mesas**: Visualización en tiempo real del estado de todas las mesas
- **Gestión de Comandas**: Creación y seguimiento de comandas
- **KDS (Kitchen Display System)**: Pantallas para cocina y barra
- **Sistema de Roles Híbrido**: permisos legacy + capacidades granulares por membresía
- **Tiempo Real**: Actualizaciones instantáneas de estado
- **Tipos de Pedido**: En mesa, para llevar, a domicilio, WhatsApp

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Autenticación**: NextAuth (JWT session strategy) + validación server-side por tenant
- **Tiempo Real**: Socket.io (pendiente implementación completa)

## 📋 Prerequisitos

- Node.js 18+ 
- PostgreSQL 14+
- npm o yarn

## 🔧 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd app-comandas-restaurante
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Editar `.env` y configurar:
   - `DATABASE_URL`: URL de conexión a PostgreSQL
   - `JWT_SECRET`: Clave secreta para JWT (generar una aleatoria)

4. **Configurar base de datos**
   ```bash
   # Generar cliente Prisma
   npm run db:generate

   # Ejecutar migraciones
   npm run db:migrate
   ```

5. **Crear datos iniciales (usuarios, mesas, productos)**
   ```bash
   npm run db:seed
   ```
   
   Esto creará:
   - Usuario admin: `admin@restaurante.com` / `admin123`
   - Usuario mesero: `mesero@restaurante.com` / `mesero123`
   - Usuario cocinero: `cocinero@restaurante.com` / `cocinero123`
   - 12 mesas (números 1-12)
   - Categorías y productos de ejemplo

6. **Iniciar servidor de desarrollo**
   ```bash
   npm run dev
   ```

   La aplicación estará disponible en `http://localhost:3000`

## 🌱 Script de Seed

El script `scripts/seed.ts` crea datos iniciales para comenzar a trabajar:

- **Usuarios de prueba** con diferentes roles
- **12 mesas** distribuidas en Salón y Terraza
- **Categorías** (Comida, Bebidas, Postres)
- **Productos de ejemplo**

Ejecutar con:
```bash
npm run db:seed
```

## 📁 Estructura del Proyecto

```
.
├── app/
│   ├── api/              # API Routes
│   │   ├── auth/         # Autenticación
│   │   ├── comandas/     # Endpoints de comandas
│   │   ├── mesas/        # Endpoints de mesas
│   │   └── productos/    # Endpoints de productos
│   ├── dashboard/        # Páginas del dashboard
│   │   ├── mesas/        # Mapa de mesas
│   │   ├── cocina/       # KDS Cocina
│   │   ├── barra/        # KDS Barra
│   │   └── comandas/     # Gestión de comandas
│   ├── login/            # Página de login
│   └── layout.tsx        # Layout principal
├── components/           # Componentes reutilizables
├── lib/                  # Utilidades y helpers
│   ├── auth-server.ts    # Sesión server-side con contexto activo y rol efectivo
│   ├── permisos.ts       # Permisos legacy + capacidades
│   ├── prisma.ts         # Cliente Prisma
│   └── comanda-helpers.ts # Helpers de comandas
├── prisma/
│   └── schema.prisma     # Esquema de base de datos
└── middleware.ts         # Middleware de Next.js
```

## 🔐 Multitenancy, roles y permisos

- El sistema opera por **sucursal** (`Restaurante`) y opcionalmente por **organización** (`Organizacion`).
- La pertenencia se modela con `SucursalMiembro` y `OrganizacionMiembro`.
- El contexto activo vive en `activeRestauranteId` / `activeOrganizacionId`.
- El rol efectivo para autorización se resuelve desde la membresía de la sucursal activa (`SucursalMiembro.rolId`) con fallback de compatibilidad.
- Los permisos se evalúan con capa híbrida (`lib/permisos.ts`): módulos legacy + capacidades granulares.

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo

# Base de datos
npm run db:generate      # Generar cliente Prisma
npm run db:push          # Push schema a base de datos (sin migraciones)
npm run db:migrate       # Ejecutar migraciones
npm run db:studio        # Abrir Prisma Studio (GUI para BD)
npm run db:seed          # Ejecutar seed (crear datos iniciales)

# Producción
npm run build            # Construir para producción
npm start                # Iniciar servidor de producción
```

## 🗺️ Roadmap MVP (POS desacoplado)

Ver [.md/PRD_Y_ROADMAP_MVP.md](.md/PRD_Y_ROADMAP_MVP.md) para el plan completo.

- [x] **Fase 1 – Payment Abstraction Layer**: Interfaz de pagos, plugins Stripe y Conekta, webhooks.
- [ ] **Fase 2 – Print Abstraction Layer**: Documento único → ESC/POS, impresora por red.
- [ ] **Fase 3 – Contabilidad automática**: Registro por pago confirmado, reporte/export.
- [ ] **Fase 4 – Ajustes MVP**: Configuración de impresoras, segundo plugin si aplica.

La capa de pagos vive en `lib/payments/` (tipos, interfaz, registro, plugins). Las rutas `/api/pagos/stripe/*` y `/api/webhooks/stripe` y `/api/webhooks/conekta` usan la abstracción.

## 🚧 Pendiente de Implementar

- [ ] WebSocket completo (Socket.io) para actualizaciones en tiempo real
- [ ] Generación de PDFs para tickets
- [ ] Sistema de reportes
- [ ] Gestión de productos y categorías desde admin
- [x] Gestión de usuarios y roles desde admin
- [ ] Sistema de notificaciones push
- [ ] Capa de impresión ESC/POS (ver roadmap)

## 📚 Documentación

Ver `.md/DOCUMENTACION_TECNICA_APP_COMANDAS.md` para documentación técnica completa.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial.

---

**Versión**: 1.0.0  
**Última actualización**: 2024
