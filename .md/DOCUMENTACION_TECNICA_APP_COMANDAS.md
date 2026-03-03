# 📋 Documentación Técnica: Sistema de Comandas para Restaurantes

## 📑 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Modelo de Datos](#modelo-de-datos)
5. [Flujos de Trabajo](#flujos-de-trabajo)
6. [Componentes Principales](#componentes-principales)
7. [APIs y Endpoints](#apis-y-endpoints)
8. [Sistema de Autenticación y Roles](#sistema-de-autenticación-y-roles)
9. [Comunicación en Tiempo Real](#comunicación-en-tiempo-real)
10. [Integraciones](#integraciones)
11. [Despliegue y Configuración](#despliegue-y-configuración)

---

## 1. Resumen Ejecutivo

### 🎯 Objetivo del Sistema

Sistema de comandas + mini POS diseñado para restaurantes, bares y cocinas ocultas que:
- Reciben pedidos en mesa y por WhatsApp
- Necesitan orden, velocidad y eliminación de papelitos/gritos a cocina
- Requieren un sistema único donde todos ven lo que les toca en el momento correcto

### 🏗️ Filosofía de Diseño

**Sin chat, sin floro**: Es una herramienta de operación, no un juguete de IA. Diseñada para:
- Restaurantes pequeños/medianos que quieren ordenarse
- Fácil de usar por personal que no es tech
- Eliminar la necesidad de gritar órdenes a cocina

---

## 2. Arquitectura del Sistema

### 2.1 Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Mesero/    │  │    Cocina    │  │    Barra     │        │
│  │   Cajero     │  │   (KDS)      │  │   (KDS)      │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │    Admin     │  │   WhatsApp    │                          │
│  │   Panel      │  │   Connector   │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/REST + WebSocket
                          │
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Next.js API Routes)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Auth API   │  │  Comandas    │  │  Notific.    │        │
│  │              │  │     API      │  │     API      │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Socket.io   │  │   Firebase   │  │   PDF Gen    │        │
│  │   Server     │  │    Chat      │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Prisma ORM
                          │
┌─────────────────────────────────────────────────────────────┐
│              BASE DE DATOS (PostgreSQL)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Usuarios   │  │   Comandas   │  │   Mesas       │        │
│  │   Roles      │  │   Items      │  │   Productos   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Patrón de Arquitectura

- **Full-Stack Next.js**: Aplicación monolítica con API Routes integradas
- **Server-Side Rendering (SSR)**: Para páginas administrativas
- **Client-Side Rendering (CSR)**: Para interfaces interactivas (KDS, mapa de mesas)
- **API Routes**: Endpoints RESTful para operaciones CRUD
- **WebSockets**: Comunicación en tiempo real para actualizaciones de estado

### 2.3 Separación de Responsabilidades

```
app/
├── api/              # API Routes (Backend)
├── dashboard/       # Vistas administrativas
├── (auth)/          # Páginas de autenticación
└── layout.tsx       # Layout principal

lib/
├── auth.ts          # Lógica de autenticación
├── prisma.ts        # Cliente Prisma
├── comanda-helpers.ts # Helpers de comandas
└── notifications.ts # Sistema de notificaciones

components/
└── [Componentes reutilizables]
```

---

## 3. Stack Tecnológico

### 3.1 Frontend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Next.js** | 14.0.0 | Framework React con SSR/SSG |
| **React** | 18.2.0 | Biblioteca UI |
| **TypeScript** | 5.2.2 | Tipado estático |
| **Tailwind CSS** | 3.3.6 | Framework CSS utility-first |
| **React Hook Form** | 7.47.0 | Manejo de formularios |
| **Zod** | 3.22.4 | Validación de esquemas |
| **React Hot Toast** | 2.4.1 | Notificaciones toast |
| **Heroicons** | 2.0.18 | Iconos SVG |
| **Socket.io Client** | - | Cliente WebSocket |

### 3.2 Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Next.js API Routes** | 14.0.0 | Endpoints REST |
| **Prisma ORM** | 5.6.0 | ORM para PostgreSQL |
| **PostgreSQL** | 14+ | Base de datos relacional |
| **JWT (jose)** | 6.1.0 | Autenticación con tokens |
| **bcryptjs** | 2.4.3 | Hash de contraseñas |
| **Socket.io** | 4.7.4 | Servidor WebSocket |
| **PDFKit** | 0.14.0 | Generación de PDFs |
| **Firebase** | 12.6.0 | Chat en tiempo real |

### 3.3 Herramientas de Desarrollo

| Tecnología | Propósito |
|------------|-----------|
| **ESLint** | Linter de código |
| **TypeScript** | Compilador de tipos |
| **Prisma Studio** | GUI para base de datos |
| **Docker** | Containerización (opcional) |

---

## 4. Modelo de Datos

### 4.1 Esquema Principal (Prisma)

#### 4.1.1 Usuario y Roles

```prisma
enum Rol {
  MESERO
  CAJERO
  COCINERO
  BARTENDER
  ADMIN
  GERENTE
}

model Usuario {
  id            String    @id @default(cuid())
  email         String    @unique
  nombre        String
  apellido      String
  password      String
  rol           Rol
  activo        Boolean   @default(true)
  ultimoAcceso  DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  comandasCreadas    Comanda[]
  comandasAsignadas  Comanda[]
  auditoria          Auditoria[]
}
```

#### 4.1.2 Mesa

```prisma
model Mesa {
  id              String    @id @default(cuid())
  numero          Int       @unique
  capacidad       Int
  estado          EstadoMesa @default(LIBRE)
  ubicacion       String?   // "Salón", "Terraza", etc.
  activa          Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  comandas        Comanda[]
}

enum EstadoMesa {
  LIBRE           // Verde
  OCUPADA         // Amarillo
  CUENTA_PEDIDA   // Rojo
  RESERVADA
}
```

#### 4.1.3 Comanda

```prisma
model Comanda {
  id              String        @id @default(cuid())
  numeroComanda   String        @unique
  mesaId          String?
  clienteId       String?       // Para pedidos a domicilio/WhatsApp
  tipoPedido      TipoPedido   @default(EN_MESA)
  estado          EstadoComanda @default(PENDIENTE)
  total           Float
  propina         Float?        @default(0)
  descuento       Float?        @default(0)
  observaciones   String?
  fechaCreacion   DateTime      @default(now())
  fechaCompletado DateTime?
  fechaEntrega    DateTime?
  creadoPorId     String
  asignadoAId     String?
  
  mesa            Mesa?         @relation(fields: [mesaId], references: [id])
  cliente         Cliente?      @relation(fields: [clienteId], references: [id])
  items           ComandaItem[]
  creadoPor       Usuario      @relation("ComandaCreadaPor", fields: [creadoPorId], references: [id])
  asignadoA       Usuario?     @relation("ComandaAsignadaA", fields: [asignadoAId], references: [id])
  historial       ComandaHistorial[]
}

enum TipoPedido {
  EN_MESA
  PARA_LLEVAR
  A_DOMICILIO
  WHATSAPP
}

enum EstadoComanda {
  PENDIENTE
  EN_PREPARACION
  LISTO
  SERVIDO
  PAGADO
  CANCELADO
}
```

#### 4.1.4 Producto y Categorías

```prisma
model Categoria {
  id          String     @id @default(cuid())
  nombre      String
  descripcion String?
  tipo        TipoCategoria
  orden       Int        @default(0)
  activa      Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  
  productos   Producto[]
}

enum TipoCategoria {
  COMIDA
  BEBIDA
  POSTRE
  ENTRADA
}

model Producto {
  id          String     @id @default(cuid())
  nombre      String
  descripcion String?
  precio      Float
  categoriaId String
  activo      Boolean    @default(true)
  imagenUrl   String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  
  categoria   Categoria @relation(fields: [categoriaId], references: [id])
  items       ComandaItem[]
  modificadores ModificadorProducto[]
}

model Modificador {
  id          String     @id @default(cuid())
  nombre      String     // "Sin cebolla", "Bien cocido", etc.
  tipo        TipoModificador
  precioExtra Float?     @default(0)
  activo      Boolean    @default(true)
  
  productos   ModificadorProducto[]
}

enum TipoModificador {
  INGREDIENTE
  COCCION
  TAMAÑO
  EXTRAS
}
```

#### 4.1.5 Items de Comanda

```prisma
model ComandaItem {
  id              String        @id @default(cuid())
  comandaId       String
  productoId      String
  cantidad        Int           @default(1)
  precioUnitario  Float
  subtotal        Float
  notas           String?       // "Sin sal", "Muy frío", etc.
  estado          EstadoItem    @default(PENDIENTE)
  destino         DestinoItem   // COCINA o BARRA
  fechaPreparacion DateTime?
  fechaListo      DateTime?
  
  comanda         Comanda       @relation(fields: [comandaId], references: [id], onDelete: Cascade)
  producto        Producto      @relation(fields: [productoId], references: [id])
  modificadores   ItemModificador[]
}

enum EstadoItem {
  PENDIENTE
  EN_PREPARACION
  LISTO
  ENTREGADO
}

enum DestinoItem {
  COCINA
  BARRA
}
```

### 4.2 Relaciones Clave

```
Usuario ──< Comanda (creadoPor)
Usuario ──< Comanda (asignadoA)
Mesa ──< Comanda
Cliente ──< Comanda
Comanda ──< ComandaItem
Producto ──< ComandaItem
Categoria ──< Producto
```

---

## 5. Flujos de Trabajo

### 5.1 Flujo: Pedido en Mesa

```
┌─────────┐
│ Mesero  │
└────┬────┘
     │
     │ 1. Abre mesa en mapa
     ▼
┌─────────────────┐
│ Mapa de Mesas   │
│ Estado: Verde → │
│      Amarillo   │
└────┬────────────┘
     │
     │ 2. Crea comanda
     ▼
┌──────────────────────┐
│ Formulario Comanda   │
│ - Selecciona mesa    │
│ - Personas (opc.)    │
│ - Productos         │
│ - Modificadores      │
└────┬─────────────────┘
     │
     │ 3. Guarda comanda
     ▼
┌──────────────────────┐
│ Sistema procesa:     │
│ - Items comida →     │
│   Pantalla Cocina    │
│ - Items bebida →    │
│   Pantalla Barra     │
└────┬─────────────────┘
     │
     │ 4. Notificación en tiempo real
     ▼
┌─────────────┐    ┌─────────────┐
│   Cocina    │    │    Barra     │
│  (KDS)      │    │   (KDS)      │
│ Ve pedidos  │    │ Ve pedidos  │
└────┬────────┘    └────┬────────┘
     │                  │
     │ 5. Marca "En preparación"
     │ 6. Marca "Listo"
     ▼                  ▼
┌─────────────────────────────┐
│ Mesero ve notificación:     │
│ "Mesa 5 - Listo para recoger"│
└─────────────────────────────┘
     │
     │ 7. Marca "Servido"
     ▼
┌─────────────────┐
│ Cliente pide    │
│ cuenta          │
└────┬────────────┘
     │
     │ 8. Divide cuenta (opcional)
     │ 9. Aplica propina
     │ 10. Genera ticket
     ▼
┌─────────────────┐
│ Mesa: Libre     │
│ (Verde)         │
└─────────────────┘
```

### 5.2 Flujo: Pedido por WhatsApp

```
┌──────────────┐
│ Cliente      │
│ (WhatsApp)   │
└──────┬───────┘
       │
       │ 1. Envía mensaje
       ▼
┌──────────────────┐
│ Persona atiende  │
│ WhatsApp         │
└──────┬───────────┘
       │
       │ 2. Confirma pedido
       │ 3. Abre app
       ▼
┌──────────────────────┐
│ Crea comanda:       │
│ - Tipo: "Para llevar"│
│   o "A domicilio"    │
│ - Mesa virtual:      │
│   "W-01", "W-02"     │
│ - Cliente: nombre    │
│ - Nota entrega       │
└──────┬───────────────┘
       │
       │ 4. Mismo flujo interno
       ▼
┌──────────────────────┐
│ Cocina/Barra ven:    │
│ Mesa "W-01"          │
│ (Como mesa normal)   │
└──────────────────────┘
```

### 5.3 Flujo: KDS (Kitchen Display System)

```
┌──────────────────────┐
│ Pantalla Cocina      │
│ (Actualización RT)    │
└──────┬───────────────┘
       │
       │ 1. Nuevo pedido aparece
       ▼
┌──────────────────────┐
│ Tarjeta de Pedido:   │
│ - Mesa 5             │
│ - 2x Alambre         │
│ - 1x Tacos           │
│ - Notas: "Sin cebolla"│
│ - Tiempo: 00:05:23   │
└──────┬───────────────┘
       │
       │ 2. Cocinero presiona
       │    "En preparación"
       ▼
┌──────────────────────┐
│ Estado cambia:       │
│ ⏱ En preparación    │
│ Tiempo sigue         │
└──────┬───────────────┘
       │
       │ 3. Termina, presiona
       │    "Listo"
       ▼
┌──────────────────────┐
│ Notificación a      │
│ mesero:             │
│ "Mesa 5 - Listo"    │
│ Tarjeta resaltada   │
└──────────────────────┘
```

---

## 6. Componentes Principales

### 6.1 Mapa de Mesas

**Ubicación**: `app/dashboard/mesas/page.tsx`

**Funcionalidad**:
- Visualización de todas las mesas en grid
- Colores según estado:
  - Verde: Libre
  - Amarillo: Comanda abierta
  - Rojo: Cuenta pedida
- Click en mesa → Abre/Crea comanda

**Componentes**:
```typescript
interface Mesa {
  id: string
  numero: number
  estado: EstadoMesa
  capacidad: number
  comandaActual?: Comanda
}

const MapaMesas = () => {
  // Estado de mesas en tiempo real
  // Actualización vía WebSocket
  // Navegación a comanda
}
```

### 6.2 Formulario de Comanda Rápida

**Ubicación**: `app/dashboard/comandas/nueva/page.tsx`

**Funcionalidad**:
- Selección de mesa
- Búsqueda de productos por categoría
- Agregar modificadores
- Vista previa de total

**Flujo**:
1. Seleccionar mesa
2. Buscar/seleccionar categoría
3. Agregar productos
4. Aplicar modificadores
5. Agregar notas
6. Confirmar comanda

### 6.3 KDS Cocina

**Ubicación**: `app/dashboard/cocina/page.tsx`

**Funcionalidad**:
- Lista de items de comida pendientes
- Agrupados por mesa
- Ordenados por tiempo (más antiguos arriba)
- Botones de estado: "En preparación" → "Listo"
- Tiempo transcurrido visible

**Características**:
- Auto-refresh vía WebSocket
- Sonido opcional al nuevo pedido
- Filtros: Todas / En preparación / Listas

### 6.4 KDS Barra

**Ubicación**: `app/dashboard/barra/page.tsx`

**Funcionalidad**:
- Similar a KDS Cocina
- Solo muestra bebidas
- Estados: "Listo" → "Entregado a mesero"

### 6.5 Panel de Cuenta

**Ubicación**: `app/dashboard/comandas/[id]/cuenta/page.tsx`

**Funcionalidad**:
- Ver cuenta completa
- Dividir cuenta:
  - Por persona
  - Por productos
- Aplicar propina (%)
- Aplicar descuentos
- Generar ticket PDF
- Marcar como pagado

---

## 7. APIs y Endpoints

### 7.1 Autenticación

#### `POST /api/auth/login`
```typescript
Request: {
  email: string
  password: string
}

Response: {
  success: boolean
  data: {
    user: Usuario
    token: string
  }
}
```

#### `GET /api/auth/me`
```typescript
Headers: {
  Authorization: "Bearer <token>"
}

Response: {
  success: boolean
  data: Usuario
}
```

### 7.2 Comandas

#### `GET /api/comandas`
```typescript
Query Params: {
  estado?: EstadoComanda
  mesaId?: string
  page?: number
  limit?: number
}

Response: {
  success: boolean
  data: Comanda[]
  total: number
}
```

#### `POST /api/comandas`
```typescript
Request: {
  mesaId?: string
  clienteId?: string
  tipoPedido: TipoPedido
  items: {
    productoId: string
    cantidad: number
    modificadores?: string[]
    notas?: string
  }[]
  observaciones?: string
}

Response: {
  success: boolean
  data: Comanda
}
```

#### `PATCH /api/comandas/[id]`
```typescript
Request: {
  estado?: EstadoComanda
  // ... otros campos
}

Response: {
  success: boolean
  data: Comanda
}
```

#### `GET /api/comandas/[id]/pdf`
```typescript
Response: PDF file (ticket)
```

### 7.3 Items de Comanda

#### `PATCH /api/comandas/[id]/items/[itemId]`
```typescript
Request: {
  estado: EstadoItem
}

Response: {
  success: boolean
  data: ComandaItem
}
```

### 7.4 Mesas

#### `GET /api/mesas`
```typescript
Response: {
  success: boolean
  data: Mesa[]
}
```

#### `PATCH /api/mesas/[id]`
```typescript
Request: {
  estado: EstadoMesa
}

Response: {
  success: boolean
  data: Mesa
}
```

### 7.5 Productos

#### `GET /api/productos`
```typescript
Query Params: {
  categoriaId?: string
  tipo?: TipoCategoria
  activo?: boolean
}

Response: {
  success: boolean
  data: Producto[]
}
```

### 7.6 Reportes

#### `GET /api/reportes`
```typescript
Query Params: {
  fechaInicio: string
  fechaFin: string
  tipo?: 'ventas' | 'mesero' | 'mesa' | 'producto'
}

Response: {
  success: boolean
  data: ReporteData
}
```

---

## 8. Sistema de Autenticación y Roles

### 8.1 Autenticación JWT

**Implementación**: `lib/auth.ts`

```typescript
// Generación de token
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

// Verificación de token
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch (error) {
    return null
  }
}
```

**Payload del Token**:
```typescript
interface JWTPayload {
  userId: string
  email: string
  rol: Rol
  sucursales: string[]
  permisos: string[]
}
```

### 8.2 Roles y Permisos

#### Roles del Sistema

| Rol | Descripción | Permisos Principales |
|-----|-------------|---------------------|
| **MESERO** | Atiende mesas | Ver mesas, crear comandas, ver estado, pedir cuenta |
| **CAJERO** | Maneja pagos | Ver comandas, procesar pagos, dividir cuenta |
| **COCINERO** | Prepara comida | Ver KDS cocina, actualizar estado items |
| **BARTENDER** | Prepara bebidas | Ver KDS barra, actualizar estado items |
| **ADMIN** | Administración | Gestión de menú, usuarios, precios |
| **GERENTE** | Supervisión | Ver reportes, ventas, tiempos |

#### Sistema de Permisos Granulares

```typescript
// Permisos por módulo
const permisos = {
  'mesas.ver': ['MESERO', 'CAJERO', 'ADMIN', 'GERENTE'],
  'mesas.crear': ['MESERO', 'ADMIN'],
  'comandas.crear': ['MESERO', 'ADMIN'],
  'comandas.ver': ['MESERO', 'CAJERO', 'COCINERO', 'BARTENDER', 'ADMIN', 'GERENTE'],
  'comandas.modificar': ['MESERO', 'ADMIN'],
  'cocina.ver': ['COCINERO', 'ADMIN', 'GERENTE'],
  'cocina.actualizar': ['COCINERO', 'ADMIN'],
  'barra.ver': ['BARTENDER', 'ADMIN', 'GERENTE'],
  'barra.actualizar': ['BARTENDER', 'ADMIN'],
  'cuenta.procesar': ['CAJERO', 'ADMIN'],
  'reportes.ver': ['GERENTE', 'ADMIN'],
  'menu.editar': ['ADMIN'],
  'usuarios.crear': ['ADMIN']
}
```

### 8.3 Middleware de Autenticación

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Token requerido' },
      { status: 401 }
    )
  }
  
  const payload = await verifyTokenEdge(token)
  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Token inválido' },
      { status: 401 }
    )
  }
  
  // Agregar usuario al request
  request.headers.set('x-user-id', payload.userId)
  request.headers.set('x-user-rol', payload.rol)
}
```

### 8.4 Protección de Rutas

```typescript
// app/api/comandas/route.ts
export async function POST(request: NextRequest) {
  const user = await getUserFromToken(token)
  
  if (!user.permisos?.includes('comandas.crear')) {
    return NextResponse.json(
      { success: false, error: 'Sin permisos' },
      { status: 403 }
    )
  }
  
  // ... lógica de creación
}
```

---

## 9. Comunicación en Tiempo Real

### 9.1 Socket.io

**Servidor**: `backend/src/index.ts`

```typescript
// Eventos principales
io.on('connection', (socket) => {
  // Unirse a sala de sucursal
  socket.on('join-sucursal', (sucursalId: string) => {
    socket.join(`sucursal-${sucursalId}`)
  })
  
  // Unirse a sala de cocina
  socket.on('join-cocina', () => {
    socket.join('cocina')
  })
  
  // Unirse a sala de barra
  socket.on('join-barra', () => {
    socket.join('barra')
  })
  
  // Actualizar estado de item
  socket.on('item-estado-update', (data) => {
    // Actualizar en BD
    // Emitir a sala correspondiente
    io.to('cocina').emit('item-updated', data)
  })
})
```

**Cliente**: `frontend/src/lib/socket.ts`

```typescript
class SocketClient {
  connect(token?: string) {
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    })
  }
  
  joinCocina() {
    this.socket?.emit('join-cocina')
  }
  
  onItemUpdated(callback: (item: ComandaItem) => void) {
    this.socket?.on('item-updated', callback)
  }
}
```

### 9.2 Eventos WebSocket

| Evento | Emisor | Receptor | Propósito |
|--------|--------|----------|-----------|
| `comanda-created` | Backend | Todos | Nueva comanda creada |
| `comanda-updated` | Backend | Todos | Comanda actualizada |
| `item-estado-update` | Cliente | Backend | Cambio de estado de item |
| `item-updated` | Backend | Cocina/Barra | Item actualizado |
| `mesa-estado-changed` | Backend | Meseros | Cambio de estado de mesa |
| `notificacion` | Backend | Usuario específico | Notificación personalizada |

### 9.3 Firebase Chat (Opcional)

Para chat interno entre personal:

```typescript
// lib/firebase-chat.ts
export function subscribeToChannelMessages(
  canalId: string,
  callback: (mensajes: Mensaje[]) => void
) {
  const messagesRef = collection(
    db,
    `canales/${canalId}/mensajes`
  )
  
  return onSnapshot(
    query(messagesRef, orderBy('fechaEnvio', 'desc'), limit(50)),
    (snapshot) => {
      const mensajes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      callback(mensajes)
    }
  )
}
```

---

## 10. Integraciones

### 10.1 Generación de PDFs

**Implementación**: `lib/pdf-generator.ts`

```typescript
import PDFDocument from 'pdfkit'

export async function generarTicketPDF(comanda: Comanda): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [80, 200], // Ticket pequeño
    margins: { top: 5, bottom: 5, left: 5, right: 5 }
  })
  
  // Header con logo
  doc.image('logo.png', 10, 10, { width: 60 })
  doc.text('Restaurante XYZ', { align: 'center' })
  doc.text(`Comanda: ${comanda.numeroComanda}`, { align: 'center' })
  
  // Items
  comanda.items.forEach(item => {
    doc.text(`${item.cantidad}x ${item.producto.nombre} - $${item.subtotal}`)
  })
  
  // Total
  doc.text(`Total: $${comanda.total}`, { align: 'right' })
  
  return doc
}
```

### 10.2 Impresora de Tickets

**Integración con impresoras térmicas**:

```typescript
// Usando biblioteca de impresoras térmicas
import { Printer } from 'node-thermal-printer'

export async function imprimirTicket(comanda: Comanda) {
  const printer = new Printer({
    type: 'epson',
    interface: 'tcp://192.168.1.100:9100'
  })
  
  printer.alignCenter()
  printer.text('Restaurante XYZ')
  printer.text(`Comanda: ${comanda.numeroComanda}`)
  printer.newLine()
  
  comanda.items.forEach(item => {
    printer.text(`${item.cantidad}x ${item.producto.nombre}`)
    printer.text(`$${item.subtotal}`)
  })
  
  printer.cut()
  await printer.execute()
}
```

### 10.3 WhatsApp (Conector Manual)

**No es un bot automatizado**. Flujo:

1. Persona atiende WhatsApp
2. Confirma pedido con cliente
3. Abre app y crea comanda manualmente
4. Marca como tipo "WHATSAPP"
5. Sistema procesa normalmente

**Futuro**: Integración con API de WhatsApp Business (opcional)

### 10.4 Notificaciones Push

```typescript
// lib/notifications.ts
export async function notificarComandaLista(
  comandaId: string,
  mesaId: string
) {
  // Notificar a meseros vía WebSocket
  io.to('meseros').emit('comanda-lista', {
    comandaId,
    mesaId,
    mensaje: `Mesa ${mesaId} - Pedido listo`
  })
  
  // Notificación push móvil (si está implementado)
  // await sendPushNotification(userId, 'Pedido listo')
}
```

---

## 11. Despliegue y Configuración

### 11.1 Variables de Entorno

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/comandas_db"

# Autenticación
JWT_SECRET="tu-secret-key-muy-segura"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-nextauth-secret"

# Socket.io
SOCKET_URL="http://localhost:3001"

# Firebase (opcional)
FIREBASE_API_KEY="..."
FIREBASE_AUTH_DOMAIN="..."
FIREBASE_PROJECT_ID="..."

# Email (opcional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="..."
SMTP_PASS="..."
```

### 11.2 Configuración de Base de Datos

```bash
# 1. Instalar Prisma
npm install prisma @prisma/client

# 2. Generar cliente
npm run db:generate

# 3. Ejecutar migraciones
npm run db:migrate

# 4. (Opcional) Abrir Prisma Studio
npm run db:studio
```

### 11.3 Scripts de Inicio

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  }
}
```

### 11.4 Docker (Opcional)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/comandas
    depends_on:
      - db
  
  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=comandas_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 11.5 Despliegue en Producción

**Vercel** (Recomendado para Next.js):
```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel
```

**Configuración en Vercel**:
- Variables de entorno: Configurar en dashboard
- Base de datos: Usar servicio externo (Supabase, Railway, etc.)
- Socket.io: Requiere servidor separado o usar Vercel Serverless Functions con límites

**Alternativa: Servidor propio**:
```bash
# Build
npm run build

# Iniciar
npm start
```

---

## 12. Consideraciones de Seguridad

### 12.1 Autenticación
- Contraseñas hasheadas con bcrypt (12 rounds)
- Tokens JWT con expiración (24h)
- Refresh tokens (opcional)

### 12.2 Validación
- Validación de entrada con Zod
- Sanitización de datos
- Protección contra SQL injection (Prisma)

### 12.3 Autorización
- Verificación de permisos en cada endpoint
- Middleware de autenticación
- Auditoría de acciones críticas

### 12.4 Rate Limiting
```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests
})
```

---

## 13. Mejoras Futuras

### 13.1 Corto Plazo
- [ ] App móvil nativa (React Native)
- [ ] Integración con impresoras térmicas
- [ ] Reportes avanzados con gráficos
- [ ] Sistema de inventario básico

### 13.2 Mediano Plazo
- [ ] Integración con WhatsApp Business API
- [ ] Sistema de reservas
- [ ] App para clientes (ver menú, hacer pedidos)
- [ ] Análisis de tiempos de preparación

### 13.3 Largo Plazo
- [ ] IA para predicción de demanda
- [ ] Optimización de rutas de meseros
- [ ] Integración con sistemas de pago
- [ ] Multi-restaurante (franquicias)

---

## 14. Conclusión

Este sistema de comandas está diseñado para ser:
- **Simple**: Fácil de usar por personal no técnico
- **Rápido**: Actualizaciones en tiempo real
- **Eficiente**: Elimina papelitos y gritos
- **Escalable**: Arquitectura que permite crecimiento
- **Mantenible**: Código limpio y documentado

La clave del éxito está en la **simplicidad operativa** y la **comunicación en tiempo real** entre todos los roles del restaurante.

---

**Versión del Documento**: 1.0  
**Última Actualización**: 2024  
**Autor**: Equipo de Desarrollo

