# PRD y Roadmap MVP — Sistema POS Desacoplado

**Versión:** 1.0  
**Fecha:** Febrero 2025  
**Resumen:** Producto agnóstico de hardware con capas de abstracción para pagos e impresión (ESC/POS).

**Configuración webhook Stripe:** Para confirmación automática por webhook, configura `STRIPE_WEBHOOK_SECRET` en `.env.local` (valor que te da Stripe al crear el endpoint en el Dashboard → Developers → Webhooks). Sin él, la confirmación sigue funcionando vía POST `/api/pagos/stripe/confirm` desde el frontend.

---

## 1. Objetivo del producto (PRD resumido)

### 1.1 Objetivo general

Sistema de gestión para restaurantes que:

- Controle órdenes, pagos y facturación.
- Sea independiente del hardware (impresoras y terminales).
- Permita integración con múltiples proveedores de pago.
- Permita imprimir desde cualquier impresora térmica compatible (ESC/POS).
- Registre automáticamente la contabilidad interna basada en confirmaciones reales de pago.
- No obligue al cliente a cambiar su hardware existente.

### 1.2 Problema que resuelve

| Problema actual | Solución |
|-----------------|----------|
| POS cerrados al hardware | Capas de abstracción (pagos + impresión). |
| Terminales imprimen su propio ticket | Documento único generado por el sistema; hardware solo ejecuta. |
| Impresoras con drivers específicos | Estándar ESC/POS; adaptadores por tipo (red/USB/BT). |
| Pagos no sincronizados con contabilidad | Webhooks → evento "pago confirmado" → registro automático. |
| Fricción con hardware ya instalado | Modo integrado (API) o registro manual asistido. |

### 1.3 Usuarios objetivo

- Dueños/gerentes de restaurantes que ya tienen terminal e impresora.
- Operadores de caja (tablet/web).
- Contabilidad interna (reportes y conciliación automática).

### 1.4 Alcance MVP vs futuro

**Dentro del MVP:**

- Core: órdenes, mesas, flujo básico de cierre.
- Una capa de pagos con interfaz estándar y al menos un plugin (ej. Stripe o Mercado Pago).
- Capa de impresión: generación de documento único (ticket/factura) y envío en ESC/POS (al menos un canal: red o USB).
- Registro contable automático al confirmar pago.
- Funcionar en web (laptop) y/o tablet.

**Fuera del MVP (post-MVP):**

- Múltiples plugins de pago simultáneos en producción.
- Múltiples tipos de impresora (Bluetooth, más fabricantes).
- Modo “registro manual asistido” para terminales sin API.
- App nativa o PWA instalable.

---

## 2. Arquitectura de referencia (4 capas)

```
┌─────────────────────────────────────────────────────────────┐
│  Capa 1: CORE                                                │
│  Órdenes, mesas, usuarios, contabilidad, eventos            │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Capa 2: PAYMENT ABSTRACTION LAYER                           │
│  Interfaz: createPayment, confirmPayment, handleWebhook      │
│  Plugins: Stripe, Mercado Pago, etc.                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Capa 3: PRINT ABSTRACTION LAYER                             │
│  Documento único → ESC/POS → Envío (red/USB/BT)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Capa 4: HARDWARE                                            │
│  Terminales, impresoras térmicas (del cliente)               │
└─────────────────────────────────────────────────────────────┘
```

- El **core** nunca depende de un proveedor de pago ni de un modelo de impresora.
- El **documento** (ticket, factura, QR, folio) se genera en core/print layer; la impresora solo recibe bytes ESC/POS.

---

## 3. Roadmap MVP (fases y entregables)

### Fase 0 — Base (ya existente o en curso)

- [ ] Base de datos (PostgreSQL), órdenes y mesas.
- [ ] Auth (JWT) y roles básicos.
- [ ] Facturación fiscal (CSD, SAT) según documentación actual del proyecto.
- [ ] Variables de entorno y configuración (.env).

**Entregable:** Core operativo para órdenes y mesas; sin capa de pago ni impresión abstractas.

---

### Fase 1 — Payment Abstraction Layer

**Objetivo:** Definir la interfaz de pagos e implementar un primer plugin (ej. Stripe).

**Tareas:**

1. Definir interfaz interna de pagos (ej. en TypeScript o según stack):
   - `createPayment(orderId, amount, metadata)` → `{ paymentId, clientSecret? }`
   - `confirmPayment(paymentId)` → estado
   - `handleWebhook(provider, payload)` → evento normalizado "pago confirmado"
2. Implementar plugin Stripe (o Mercado Pago): mapear API del proveedor a la interfaz.
3. Exponer endpoint de webhook por proveedor (ruta dedicada que recibe el payload y llama a `handleWebhook`).
4. Al recibir "pago confirmado":
   - Marcar orden como pagada.
   - Guardar método, referencia externa y monto.
   - Emitir evento interno para contabilidad y para impresión (no implementar impresión aún, solo el evento).

**Entregable:** Un flujo de pago completo (crear → confirmar vía webhook) que actualice orden y dispare evento. Core solo usa la interfaz, no Stripe directamente.

**Criterio de aceptación:** Cambiar a otro plugin (ej. otro proveedor) no requiere tocar el core, solo agregar otro adaptador.

---

### Fase 2 — Print Abstraction Layer (documento + ESC/POS)

**Objetivo:** Generar el documento único (ticket/factura) y enviarlo en ESC/POS a una impresora.

**Tareas:**

1. Definir modelo de “documento de impresión” (ticket de venta, factura, comprobante, QR, folio interno) en el core o en la capa de impresión.
2. Implementar generación de contenido: texto/formato del ticket y/o factura (y QR si aplica) a partir de orden + datos fiscales.
3. Implementar transformación a ESC/POS (biblioteca o módulo que genere los bytes ESC/POS).
4. Implementar un primer “adaptador de salida” (ej. impresora por red: IP:puerto o servicio que reciba el job y lo envíe por socket).
5. Conectar el evento “pago confirmado” (o “orden cerrada”) con “generar documento → ESC/POS → enviar a impresora”.

**Entregable:** Al confirmar un pago (o cerrar orden), se genera el ticket/factura en ESC/POS y se envía a una impresora configurada (ej. por IP). No depender del ticket de la terminal.

**Criterio de aceptación:** Cambiar de impresora (misma red o otra compatible ESC/POS) solo requiere cambiar configuración (IP/puerto o futuro USB), no código del core.

---

### Fase 3 — Contabilidad automática y conciliación

**Objetivo:** Cada pago confirmado quede registrado y conciliable.

**Tareas:**

1. Modelo de registros contables: orden ↔ pago ↔ método ↔ referencia externa (id del proveedor).
2. Al procesar webhook “pago confirmado”: crear registro contable automático (fecha, monto, método, referencia).
3. Vista o reporte básico de movimientos por período y por método de pago.
4. (Opcional MVP) Exportar lista de pagos con referencia para conciliar con estado de cuenta del proveedor.

**Entregable:** Sin captura manual; cada pago confirmado tiene su línea contable y se puede revisar/exportar.

---

### Fase 4 — Ajustes MVP y canal adicional (opcional)

**Objetivo:** Estabilizar MVP y, si aplica, un segundo canal de impresión o de pago.

**Tareas:**

1. Pruebas E2E: flujo orden → pago (webhook) → registro contable → impresión.
2. Configuración de impresora(s) por establecimiento o por punto de venta (archivo o BD).
3. (Opcional) Segundo plugin de pago (ej. Mercado Pago) o segundo adaptador de impresión (ej. USB o cola local).
4. Documentación mínima: cómo configurar un proveedor de pago y cómo configurar una impresora ESC/POS.

**Entregable:** MVP estable, documentado y listo para uso en un entorno real (un proveedor de pago, al menos un tipo de impresora).

---

## 4. Resumen de hitos

| Hito | Contenido |
|------|-----------|
| **M1** | Core (órdenes, mesas, auth, fiscal) estable. |
| **M2** | Payment abstraction + 1 plugin; webhook actualiza orden y dispara evento. |
| **M3** | Documento único → ESC/POS → impresora (red); disparado por pago/cierre. |
| **M4** | Contabilidad automática por pago confirmado; reporte/export básico. |
| **M5** | MVP cerrado: flujo completo + configuración + doc mínima. |

---

## 5. Restricciones (recordatorio)

- No depender de un único proveedor de pagos (siempre usar la interfaz).
- No forzar hardware específico (abstracción de impresión).
- No depender del ticket generado por la terminal bancaria (documento propio + ESC/POS).
- No obligar a cambiar impresora si es compatible con ESC/POS.

---

## 6. Frase técnica (visión)

> Construir un POS desacoplado de hardware mediante una capa de abstracción para pagos y otra para impresión, usando estándares predominantes (APIs de proveedores y ESC/POS), permitiendo interoperabilidad con múltiples dispositivos existentes sin depender de un ecosistema cerrado.

---

*Documento generado a partir de la descripción técnica del sistema. Para ampliar con RFC de decisiones, diagramas C4 o propuesta comercial, usar este PRD/Roadmap como base.*
