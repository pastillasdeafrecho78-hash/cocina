# Executive Summary

El siguiente salto del producto se implementa en dos pistas paralelas y compatibles:

1) **Acceso operativo sin friccion**: credenciales + membresia activa por sucursal como camino primario; OAuth Google/Meta opcional y secundario.  
2) **Segunda app conectada al backend principal**: frontend independiente que crea pedidos por contrato API v1 con auth de app por sucursal, tenant routing estricto e idempotencia.

Decision tecnica central: mantener **backend y base canonica unica** para comandas en v1. Evitar DB separadas y event bus temprano.

## Artefactos incluidos en este paquete

- Estrategia de acceso e identidad: `.md/ADR_ACCESO_IDENTIDAD_ONBOARDING_V1.md`
- Arquitectura de segunda app: `.md/ARQUITECTURA_SEGUNDA_APP_Y_COMUNICACION_V1.md`
- Contrato API v1 de pedido externo: `.md/CONTRATO_CREATE_EXTERNAL_ORDER_V1.md`

---

# Paquete de ejecucion para otra instancia

## 1) Objetivo de implementacion

Implementar vertical slice completo:

- autenticacion operativa rapida no bloqueada por OAuth,
- creacion de pedido desde segunda app,
- visualizacion correcta en app principal (sucursal correcta),
- control de duplicados y errores canonicos.

## 2) Orden recomendado de trabajo

## Fase A — Contract-first y hardening (prioridad maxima)

1. Congelar esquema request/response de `CreateExternalOrder`.
2. Agregar/confirmar error codes canonicos (`code` obligatorio).
3. Implementar idempotencia por `x-idempotency-key`.
4. Endurecer validacion key->slug->restauranteId.

Salida esperada:

- tests de contrato en verde,
- endpoint v1 estable.

## Fase B — Capa de dominio reutilizable

1. Crear `OrderIngestionService` comun para rutas:
   - staff,
   - public,
   - external.
2. Mover validaciones de catalogo y tenant a service layer.
3. Eliminar divergencia funcional entre canales.

Salida esperada:

- una sola fuente de logica para crear comandas.

## Fase C — Segunda app vertical slice

1. Cliente de segunda app consume endpoint v1.
2. Implementa retry con misma idempotency key.
3. Implementa polling de estado.

Salida esperada:

- orden creada en segunda app aparece en dashboard/cocina/barra de sucursal correcta.

## Fase D — Operacion y observabilidad

1. Logging estructurado con correlation id.
2. Alertas para:
   - branch_scope_mismatch,
   - invalid_item_scope,
   - rate_limited.
3. Dashboard operativo de errores por tenant/key.

Salida esperada:

- soporte tecnico accionable y rastreable.

---

# Backlog tecnico (epics -> historias)

## Epic 1: Access Fast-Path

Historias:

- H1. Mantener login por credenciales como default.
- H2. Validar que OAuth no sea gate para operar.
- H3. Mensajes accionables de invitacion/codigo/contexto.
- H4. Revocacion de acceso por membresia inactiva.

Aceptacion:

- usuario sin OAuth puede operar con permisos correctos.

## Epic 2: External Order Contract

Historias:

- H1. Implementar headers requeridos (`x-api-key`, `x-restaurante-slug`, `x-idempotency-key`).
- H2. Enforce de `code` en todos los errores.
- H3. Idempotencia consistente y comprobable.

Aceptacion:

- doble submit no duplica orden.

## Epic 3: Tenant Routing Security

Historias:

- H1. Match estricto key/sucursal.
- H2. Bloqueo de referencias cross-tenant.
- H3. Auditoria de rechazos por scope.

Aceptacion:

- no existe path para crear orden en sucursal incorrecta.

## Epic 4: Cross-App Visibility

Historias:

- H1. Estado inicial visible en app principal.
- H2. Polling estable en segunda app.
- H3. Estado terminal sincronizado.

Aceptacion:

- latencia objetivo v1 <= 5s por polling actual.

---

# Definition of Ready (DoR)

Antes de iniciar implementacion:

- [ ] contrato v1 aprobado por backend y frontend de segunda app.
- [ ] matriz de errores canonicos aprobada.
- [ ] decision de campos opcionales de `deliveryMetadata` cerrada.
- [ ] estrategia de versionado acordada (`v1`).

# Definition of Done (DoD)

- [ ] tests unitarios y de contrato pasan.
- [ ] pruebas cross-tenant en staging pasan.
- [ ] trazabilidad de cada request via correlation id.
- [ ] runbook de errores comunes entregado a soporte.
- [ ] sin accesos directos a DB desde segunda app.

---

# Matriz de pruebas de aceptacion (UAT)

## Caso 1: Happy path

- key valida + slug valido + payload valido -> `201 success`.

## Caso 2: Retry idempotente

- timeout cliente + reintento misma key -> mismo `orderId`.

## Caso 3: Mismatch de sucursal

- key de sucursal A + slug B -> `403 branch_scope_mismatch`.

## Caso 4: Catalogo obsoleto

- `catalogVersion` antigua -> `409 catalog_version_mismatch`.

## Caso 5: Tenant inactivo

- sucursal desactivada -> `409 branch_inactive`.

## Caso 6: Item fuera de scope

- producto de otra sucursal -> `422 invalid_item_scope`.

---

# Riesgos y mitigacion

Riesgo: divergencia de reglas entre rutas staff/public/external.  
Mitigacion: service layer unico de ingestion.

Riesgo: crecimiento de latencia por polling.  
Mitigacion: tuning de intervalos + webhooks fase 2.

Riesgo: fuga de credenciales API key.  
Mitigacion: hash at rest, rotacion, revocacion rapida, rate-limit.

---

# Lo que se implementa ahora vs despues

Implementar ahora:

- contrato v1 + idempotencia + tenant routing estricto,
- vertical slice segunda app -> main app,
- acceso operativo rapido sin OAuth obligatorio.

Mantener opcional:

- vincular OAuth en perfil,
- metadatos avanzados de delivery.

Postergar:

- event bus,
- DB separada,
- realtime avanzado SSE/WebSocket.

---

# Instruccion de arranque para otra instancia (copy-paste)

Objetivo: implementar `CreateExternalOrder v1` con idempotencia y branch routing seguro, reutilizando capa de dominio de comandas y manteniendo main backend como source-of-truth.

Orden:

1) Implementar/ajustar contrato `.md/CONTRATO_CREATE_EXTERNAL_ORDER_V1.md`.  
2) Extraer `OrderIngestionService` y reutilizar en canales staff/public/external.  
3) Añadir tests de contrato + tenant mismatch + duplicate submit.  
4) Construir cliente mínimo de segunda app que cree pedido y consulte estado.  
5) Validar en staging con 2 sucursales y checklist UAT de este documento.
