# Architecture and Communication Plan for Second App and Cross-App Order Flow (V1)

Estado: Propuesto para implementacion inmediata  
Fecha: 2026-04-08  
Owners: Platform + Backend + Product

## 1. Ecosistema objetivo

## 1.1 Main app (existente)

Aplicacion principal de operaciones internas:

- mesas,
- comandas y items,
- cocina/barra,
- caja/cortes/reportes,
- authz tenant-scoped por sucursal.

Es el `source_of_truth` operativo.

## 1.2 Segunda app (nueva)

Aplicacion orientada a canal externo/operador fuera del dashboard interno:

- captura de pedidos para flujo externo,
- casos de delivery propio del restaurante,
- futura evolucion a flujos cliente.

No es marketplace, no gestiona flota de terceros como negocio principal.

## 1.3 Problema a resolver

Cuando segunda app registra pedido, debe reflejarse con exactitud en la sucursal correcta dentro de la app principal, sin duplicar logica de negocio ni comprometer consistencia.

## 2. App boundaries (que vive en cada lado)

## 2.1 En backend/main app

- creacion canonica de `Comanda` y `ComandaItem`,
- validacion de catalogo/precio/reglas operativas,
- enrutamiento cocina/barra,
- control de tenant y seguridad,
- auditoria e idempotencia.

## 2.2 En segunda app

- UX de captura de pedido para actor externo,
- estado de envio/reintento offline,
- lectura de estado por contrato API,
- manejo de errores accionables de integracion.

## 2.3 Lo que no se duplica

- numeracion de comanda,
- reglas de estado,
- permisos/capabilities,
- ownership de datos canonicos.

## 3. Decision de arquitectura de datos

## 3.1 Opciones evaluadas

### Opcion A: misma DB, apps separadas, backend compartido

Pros:

- mayor velocidad de salida,
- consistencia transaccional fuerte,
- menor costo de operacion inicial.

Contras:

- riesgo alto si segunda app accede directo a DB.

### Opcion B: DB separadas + sincronizacion API

Pros:

- aislamiento fuerte entre aplicaciones.

Contras:

- complejidad alta temprana,
- reconciliacion eventual,
- riesgo de drift y soporte mas costoso.

### Opcion C: mismo backend/API, frontends distintos

Pros:

- shipping rapido,
- reglas centralizadas,
- menor deuda funcional inicial.

Contras:

- exige disciplina de boundaries para no mezclar concerns.

### Opcion D: event-driven desde inicio

Pros:

- desacople potencial a largo plazo.

Contras:

- sobreingenieria para fase temprana,
- costo operativo en observabilidad/retry/ordering.

### Opcion E: hibrido API + eventos minimos

Pros:

- camino evolutivo saludable.

Contras:

- requiere contratos y observabilidad desde ahora.

## 3.2 Recomendacion para este proyecto

`Opcion C` ahora, con evolucion a `E` despues:

- Segunda app frontend independiente.
- Backend unico compartido como kernel de dominio.
- Comunicacion solo por API versionada.
- Sin acceso directo a DB desde segunda app.

## 4. Flujo exacto: pedido segunda app -> main app

1) Usuario/operador en segunda app inicia checkout.  
2) Segunda app obtiene sucursal objetivo (slug/branchKey) y prepara `idempotency_key`.  
3) Envia `POST` a endpoint de ingestión externa con credencial de app.  
4) Backend valida:
   - credencial activa,
   - scope por sucursal,
   - sucursal activa,
   - catalogo e items validos en contexto tenant.
5) Backend persiste comanda en transaccion atomica.  
6) Devuelve `order_id`, `numero_comanda`, `estado`, `tenant_ref`, `idempotent` flag.  
7) Main app muestra pedido en colas de operacion (kitchen/bar/dashboard).  
8) Segunda app consulta estado por polling en v1.

## 5. Tenant routing (critico)

## 5.1 Mecanismo obligatorio

- API key por sucursal (`IntegracionPedidosApi` o equivalente).
- Header con identificador de sucursal (`x-restaurante-slug`/`x-branch-key`).
- Validacion cruzada key -> restauranteId.

## 5.2 Reglas de rechazo

- key valida pero no corresponde a sucursal: `403 branch_scope_mismatch`.
- sucursal inactiva: `409 branch_inactive`.
- organizacion/sucursal suspendida: `409 branch_suspended`.
- payload con referencias cross-tenant: `422 invalid_item_scope`.

## 5.3 Safeguards

- auditoria de todos los rechazos de routing,
- rate-limit por key y por tenant,
- rotacion de credenciales por sucursal.

## 6. Communication contract entre apps

## 6.1 Ahora (v1)

- HTTP JSON versionado (`v1`).
- Auth de app via API key scoped.
- Idempotencia obligatoria en creacion.
- Polling para estado.

## 6.2 Fase 2

- Webhooks firmados para eventos de orden.
- Event bus solo cuando haya multiples consumidores y carga que lo justifique.

## 7. Recomendacion v1 (rapida y sana)

Arquitectura v1:

- backend actual como unico orquestador de dominio,
- segunda app como cliente de API,
- contratos estrictos y errores canonicos,
- observabilidad operativa minima desde dia 1.

No sobreingenieria:

- sin microservicios ni DB separada en etapa inicial.

## 8. Source of truth y ownership

- `Comanda` y su estado viven en backend principal.
- segunda app nunca escribe directo en DB.
- lectura y escritura por endpoints controlados.

## 9. Modelo de autenticacion entre apps

## 9.1 Recomendado v1

- API key por sucursal (hash almacenado),
- permisos por key (`orders:create`, `orders:read`),
- rotacion manual/automatizada.

## 9.2 Evitar en v1

- uso de sesiones humanas para M2M,
- tokens complejos de service mesh sin necesidad real.

## 10. Visibilidad/realtime

## 10.1 V1 pragmatica

- Main app continua con polling existente.
- Segunda app usa polling con backoff (2s -> 5s -> 10s).

## 10.2 Evolucion

- evaluar SSE/WebSocket cuando KPI de latencia y volumen lo requiera.

## 11. Failure handling matrix

1) `wrong_branch_id` -> 403 con codigo y detalle.  
2) `offline_second_app` -> reintentos con misma idempotency key.  
3) `partial_failure` -> transaccion rollback completo.  
4) `duplicate_submit` -> respuesta idempotente con mismo order_id.  
5) `inactive_restaurant` -> 409 no retriable hasta reactivacion.  
6) `stale_catalog` -> 409 catalog_version_mismatch + endpoint de sync.

## 12. Impacto de modelo de dominio

## 12.1 Compartido canonico

- Restaurante/Organizacion
- Producto/Categoria/Modificador
- Comanda/ComandaItem
- Estado de orden y cola operativa

## 12.2 Metadata de canal (nuevo/ajuste)

Agregar/normalizar:

- `orderChannel` (STAFF_DASHBOARD, PUBLIC_LINK, EXTERNAL_APP),
- `externalOrderRef`,
- `externalSource`,
- `deliveryMetadata` (opcional).

## 13. Backend strategy concreta

## 13.1 Estructura recomendada

- Mantener rutas externas en `app/api/public/integraciones/pedidos/*`.
- Crear capa de dominio reusable:
  - `lib/orders/ingestion.ts`
  - `lib/orders/validators.ts`
  - `lib/orders/idempotency.ts`
- Reusar la capa para staff/public/external y evitar divergencia de reglas.

## 13.2 Versionado

- `/v1` en contrato (path o header `x-api-version`).
- cambios breaking solo en `v2`.

## 14. Roadmap inmediato de implementacion

1) Congelar contrato `CreateExternalOrder` + errores canonicos.  
2) Endurecer tenant routing y auth de integracion.  
3) Extraer `OrderIngestionService` comun.  
4) Implementar vertical slice de segunda app (crear pedido y ver reflejo).  
5) Implementar polling de estado + retry idempotente.  
6) Ejecutar QA cross-tenant en staging con 2 sucursales.  
7) Postergar eventos y separacion fisica de datos.

## 15. Criterios de aceptacion arquitectura v1

- [ ] Todo pedido externo termina en sucursal correcta o falla con codigo explicito.
- [ ] No hay escrituras directas a DB desde segunda app.
- [ ] Doble submit no crea duplicados.
- [ ] Main app ve pedido externo en flujo operativo en menos de 5 segundos (polling actual).
- [ ] Auditoria y rate-limits activos por key/sucursal.
