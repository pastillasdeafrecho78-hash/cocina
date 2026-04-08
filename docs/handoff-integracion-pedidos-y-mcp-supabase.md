# Handoff: integración pedidos externos, arquitectura y MCP Supabase

Documento para pegar en **otro chat de Cursor** (junto con el bloque “Prompt” del final). Resume el estado real del repo **ServimOS**, la advertencia de arquitectura (backend único vs paralelo) y cómo usar el **MCP de Supabase** para validar el esquema en la base.

---

## 1. Respuesta corta sobre MCP (misma conexión que “este” chat)

- **Misma configuración de Cursor**: si el otro chat corre en **la misma máquina y el mismo perfil de Cursor**, lee el mismo `~/.cursor/mcp.json` y verá el mismo servidor MCP llamado `supabase` apuntando a `https://mcp.supabase.com/mcp`.
- **No es “herencia automática de sesión” entre chats**: cada conversación no “arrastra” credenciales por sí sola. Lo que comparten es la **configuración** y, si Cursor ya tiene **Supabase vinculado/autenticado** para tu cuenta/proyecto, las herramientas MCP suelen funcionar igual en cualquier chat **siempre que el MCP siga habilitado** en ese workspace.
- **Si el otro chat está en otro PC o otro usuario de Cursor**, necesitará la misma configuración MCP y el mismo flujo de auth de Supabase en Cursor.

**Entrada relevante en `mcp.json` (solo referencia conceptual, sin secretos):**

```json
"supabase": {
  "url": "https://mcp.supabase.com/mcp",
  "headers": {}
}
```

**Instrucción al agente:** antes de llamar herramientas MCP, debe **listar y leer los descriptores de herramientas** del servidor (regla de Cursor). El proyecto tiene carpeta de descriptores bajo `.cursor/projects/.../mcps/user-supabase/tools/` cuando el servidor está configurado.

---

## 2. Qué es ServimOS en este repo (fuente de verdad técnica)

- **Stack:** Next.js (App Router), API en `app/api/**`, **Prisma** contra Postgres (típicamente Supabase en producción vía `DATABASE_URL`).
- **Dominio de pedidos:** las órdenes externas deben aterrizar en el modelo canónico **`Comanda`**, **`ComandaItem`**, **`Cliente`**, etc., no en tablas paralelas inventadas para una segunda app.
- **Integración API de pedidos (sucursal):** modelo `IntegracionPedidosApi` en `prisma/schema.prisma` (API key hasheada por sucursal, `activo`).
- **Idempotencia en v1 (implementación actual):** `Comanda` tiene `@@unique([restauranteId, externalOrderId])` y la ruta usa `externalOrderId` + validación de que `x-idempotency-key` coincide con `externalOrderId` (regla explícita del contrato v1).

Rutas públicas canónicas en **este** repo:

| Ruta | Archivo |
|------|---------|
| Contrato / documentación JSON | `app/api/public/integraciones/pedidos/contract/route.ts` |
| `POST` crear orden | `app/api/public/integraciones/pedidos/orders/route.ts` |
| `GET` estado por id | `app/api/public/integraciones/pedidos/orders/[id]/route.ts` |
| Config interna (dashboard) | `app/api/integraciones/pedidos/config/route.ts` |

Tests de contrato/guards (ejemplo): `tests/api/public-integraciones-orders-contract.test.ts`

La implementación `POST` ya hace, entre otras cosas:

- Headers obligatorios: `x-api-key`, `x-restaurante-slug`, `x-idempotency-key`
- Resolución tenant: slug → `Restaurante` + `integracionPedidosApi` + hash de API key
- Catálogo efectivo vía `resolveEffectiveMenu` (menú compartido/clonado por sucursal)
- Errores con forma `{ success: false, error, code, details? }`
- Creación de `Comanda` con `origen: EXTERNAL_API`

---

## 3. Contraste con el “vertical slice” Fastify + Prisma aparte (otro chat)

Otro agente puede haber descrito un **backend nuevo** (Fastify, `server.ts`, `app.ts`, migraciones Prisma propias, deploy Vercel separado). Eso es útil como **prototipo de contrato**, pero **choca** con la línea directriz de **un solo backend canónico** y **una sola base como source of truth** si se pretende mantener como sistema paralelo en producción.

**Riesgos si se consolida un backend paralelo:**

- Dos conjuntos de migraciones Prisma sobre la misma DB (o modelos desalineados).
- Duplicar reglas de comanda, catálogo, tenant y errores.
- Divergencia entre lo que ve cocina/caja/dashboard y lo que crea la “segunda app”.

**Uso sano del prototipo:** extraer ideas (idempotencia, validadores, tests) e **integrarlas en ServimOS** (`app/api/...` + `lib/...`), no desplegar un segundo servicio como dueño del dominio.

---

## 4. Checklist de auditoría (antes de aceptar arquitectura final)

1. **¿Las tablas son las de ServimOS?** Comparar con `prisma/schema.prisma` y, vía MCP Supabase o SQL, con el esquema real en Postgres.
2. **¿La orden termina en `Comanda` / `ComandaItem`?** Mismo ciclo de vida que el resto del producto.
3. **¿El catálogo es el real?** Mismo `menuRestauranteId` / `resolveEffectiveMenu`, no un catálogo mock.
4. **¿Hay migraciones nuevas conflictivas?** No aplicar migraciones de otro repo sobre producción sin revisión.
5. **¿Deploy?** Preferir una sola app Next/ServimOS o un módulo claro dentro de ella; evitar segundo backend “dueño” en v1.
6. **¿La segunda app solo consume HTTP?** Sin acceso directo a DB ni duplicar dominio.

---

## 5. Cómo debe usar el agente el MCP de Supabase

1. Confirmar que en Cursor está habilitado el servidor `supabase` (misma config que arriba).
2. Inspeccionar esquema de herramientas disponibles (descriptores JSON).
3. Usar MCP para **verificar** tablas reales: `Comanda`, `ComandaItem`, `IntegracionPedidosApi`, índices/unicidad `restauranteId + externalOrderId`, etc.
4. **No** asumir que un `schema.prisma` de otro repositorio refleja la DB de ServimOS sin contrastar.

---

## 6. Entregables esperados del otro chat

1. **Diagnóstico:** alineación del prototipo Fastify (si existe en otro workspace) vs implementación actual en ServimOS.
2. **Plan de integración:** qué código es reutilizable, qué hay que adaptar, qué descartar.
3. **Riesgos** de mantener backend paralelo.
4. **Pasos concretos** para v1: una API pública en ServimOS, segunda app solo como cliente.
5. Opcional: verificación contra Supabase (lectura de esquema / consultas seguras vía MCP), sin exponer secretos en el chat.

---

## 7. Prompt listo para pegar en el otro chat de Cursor

Copia desde aquí:

---

**Rol y contexto:** Estás en el monorepo **ServimOS** (Next.js App Router + Prisma). La integración canónica de pedidos externos ya vive bajo `app/api/public/integraciones/pedidos/` y persiste en **`Comanda`** / **`ComandaItem`** con `IntegracionPedidosApi` por sucursal. Lee `prisma/schema.prisma` y los archivos de rutas anteriores antes de proponer cambios.

**Arquitectura (obligatorio):** No consolidar ni desplegar un **segundo backend paralelo** (p. ej. Fastify + Prisma propio) como dueño del dominio. Si existe un prototipo así, trátalo como **referencia** para contrato, tests e idempotencia; la solución v1 debe **integrarse al backend principal de ServimOS** y la segunda app debe ser **solo cliente HTTP** (sin DB directa, sin duplicar reglas de negocio).

**MCP Supabase:** Usa el servidor MCP `supabase` configurado en Cursor (`https://mcp.supabase.com/mcp`). Antes de invocar herramientas, revisa sus esquemas. Úsalo para **contrastar el esquema real de Postgres** con `prisma/schema.prisma` (tablas `Comanda`, unicidad por `externalOrderId`, `IntegracionPedidosApi`, etc.). No inventes tablas ni ejecutes migraciones destructivas sin plan explícito.

**Tareas:**

1. Auditar si alguna implementación externa (otro repo) duplica modelos o migraciones frente a ServimOS.
2. Mapear qué piezas son portables a `lib/` + `app/api/` (contrato, validación de scope, idempotencia, errores canónicos).
3. Entregar: diagnóstico, plan de integración mínimo, lista reutilizable/adaptable/descartable, riesgos de backend paralelo.
4. No hacer push/deploy final que implique segundo servicio dueño del dominio sin validación explícita.

---

Fin del documento.
