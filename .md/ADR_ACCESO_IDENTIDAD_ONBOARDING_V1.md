# ADR: Fast Access, Identity, Login, Onboarding, and Account Creation Strategy (V1)

Estado: Propuesto para implementacion inmediata  
Fecha: 2026-04-08  
Owners: Product + Backend + Plataforma

## 1. Contexto de negocio y problema

El sistema principal de operaciones restaurante ya cubre flujo interno (mesas/comandas/cocina/barra/caja/reportes) y modelo multitenant por sucursal.

La friccion actual en acceso puede bloquear operaciones si se fuerza dependencias no esenciales (OAuth social, perfil completo, onboarding de billing completo).

Objetivo de esta ADR: definir un modelo de acceso de baja friccion que priorice continuidad operativa sin perder control de seguridad.

## 2. Decision de producto

### 2.1 Decision principal

Para V1:

- OAuth Google/Meta se define como `opcional_secundario`.
- Acceso primario para operar: `email_password + membresia_activa`.
- Mecanismos de habilitacion staff: `invitacion` o `codigo_de_sucursal`.
- Regla central: `dejar_entrar_primero_enriquecer_despues`.

### 2.2 Que NO se hace en V1

- No se bloquea acceso operativo por no tener OAuth.
- No se bloquea acceso operativo por perfil incompleto no critico.
- No se bloquea bootstrap inicial por facturacion avanzada completa.

## 3. Alcance por actor

## 3.1 Owner / Business Admin

Necesario para primer acceso:

- Cuenta base (email/password).
- Creacion de negocio/sucursal inicial.
- Rol admin y tenant activo.

Opcional diferido:

- Vincular Google/Meta.
- Completar datos fiscales/billing avanzados.

## 3.2 Branch Admin / Manager

Necesario:

- Membresia activa en sucursal.
- Permisos/capabilities validos.
- Contexto activo correcto.

Opcional:

- Perfil enriquecido y OAuth.

## 3.3 Employee / Staff

Necesario:

- Habilitacion por negocio (invite/codigo).
- Membresia sucursal activa.
- Credenciales validas para sesion.

Opcional:

- Datos no criticos de perfil.
- OAuth link posterior.

## 3.4 Operador externo futuro (canal app secundaria)

Necesario:

- Credencial de app con scope por sucursal.
- Contrato API estable.

No permitido:

- Uso de sesion humana del dashboard para integraciones M2M.

## 4. Flujos V1 recomendados

## 4.1 Owner crea negocio rapido

1) `POST /api/auth/register` crea usuario admin + restaurante base + membresias.  
2) Login inmediato al dashboard.  
3) Estado de suscripcion inicial: `trial` o `pending_setup`.  
4) UI muestra acciones no bloqueantes:
   - vincular OAuth,
   - configurar cobro,
   - completar datos fiscales.

## 4.2 Staff entra por invitacion

1) Manager crea invitacion (`POST /api/auth/invites`).  
2) Staff acepta (`POST /api/auth/invites/accept`).  
3) Backend crea usuario + membresias + tenant activo.  
4) Staff inicia sesion y opera.

## 4.3 Staff entra por codigo

1) Manager genera codigo (`POST /api/auth/access-codes`).  
2) Staff canjea (`POST /api/auth/access-codes/redeem`).  
3) Transaccion atomica:
   - consume codigo single-use,
   - activa/upsert membresia,
   - setea tenant activo.
4) Redireccion a operacion.

## 4.4 Completar perfil despues

Campos diferibles:

- apellido, telefono, avatar, metadata de preferencia.

Mecanica UX:

- Banner persistente de perfil incompleto.
- Desbloqueo completo de operacion, salvo requerimientos regulatorios explicitos.

## 4.5 Vinculacion OAuth posterior

1) Usuario autenticado abre configuracion.  
2) Ejecuta `signIn(provider)` para linkage.  
3) Si provider falla o no entrega email, no invalida acceso por credenciales.

## 5. Modelo de identidad (separacion de responsabilidades)

## 5.1 Capa Authentication (quien entra)

- Credenciales locales como baseline.
- OAuth como identidad complementaria.
- Sesion JWT corta y renovable.

## 5.2 Capa Membership (donde y con que permisos opera)

- Fuente de verdad: `SucursalMiembro`, `OrganizacionMiembro`.
- Tenant activo: `activeRestauranteId`, `activeOrganizacionId`.
- Guardas server-side: `requireAuthenticatedUser`, `requireActiveTenant`, `requireCapability`.

## 5.3 Capa Profile

- Enriquecimiento no bloqueante.
- Campo `profileState` recomendado para UX.

## 5.4 Capa Billing/Subscription

- Estado separado de login operativo inicial.
- Reglas de corte por impago se aplican con gracia y mensajes accionables.

## 6. Principios UX operativos (reglas de producto)

Reglas obligatorias:

1) `never_block_core_ops_for_optional_identity_fields`
2) `oauth_is_convenience_not_gate`
3) `membership_scope_is_access_key`
4) `errors_must_be_actionable`
5) `first_day_access_under_5_minutes`

Copy guidance:

- Error social sin acceso: "Pide invitacion a tu administrador."
- Error tenant: "No tienes sucursal activa. Canjea codigo o cambia contexto."
- Error profile: "Puedes continuar; completa perfil despues."

## 7. Seguridad y tradeoffs

## 7.1 Riesgos al bajar friccion

- canje fraudulento de codigos,
- brute-force en credenciales,
- reuse de links de invitacion,
- acceso en sucursal incorrecta,
- secuestro de sesion.

## 7.2 Controles minimos no negociables

- Hash de tokens/codigos (sin storage en claro).
- Expiracion corta y uso unico.
- Rate limit por IP + identity fingerprint.
- Validacion estricta de membresia activa por mutacion tenant-scoped.
- Auditoria de eventos criticos.
- Revocacion de sesion en cambios de rol/membresia.

## 7.3 Tradeoff aceptado en V1

Se acepta menor "riqueza de identidad inicial" a cambio de velocidad de entrada y continuidad operativa.

## 8. Impacto en backend y base de datos

## 8.1 Entidades existentes involucradas

- `Usuario`
- `CuentaOAuth`
- `SucursalMiembro`
- `OrganizacionMiembro`
- `Invitacion`
- `CodigoVinculacionSucursal`
- `Restaurante`, `Organizacion`
- `Rol`

## 8.2 Cambios recomendados inmediatos

1) Consolidar rol efectivo en membresias y reducir dependencia legacy en `Usuario.rolId/restauranteId`.  
2) Agregar estado de onboarding de perfil en `Usuario` (o tabla dedicada).  
3) Endurecer politicas de expiracion/reintentos para invite/codigo.  
4) Estandarizar codigos de error auth/onboarding para cliente.

## 8.3 Matriz de requeridos vs diferibles

Requeridos para operar:

- credenciales validas,
- membresia activa,
- tenant activo,
- capability valida.

Diferibles:

- OAuth,
- perfil enriquecido,
- billing avanzado.

## 9. Politica V1 final

Implementar ahora:

- Login principal por credenciales.
- Staff onboarding por invitacion/codigo.
- OAuth opcional como link posterior.
- Perfil y billing no bloqueantes para entrada inicial.

Mantener opcional:

- Google/Meta.
- Complecion de perfil.

Postergar:

- SSO empresarial,
- KYC fuerte de identidad,
- gates regulatorios no esenciales para day-0.

Evitar:

- Dependencia obligatoria de proveedor social para operar.
- Acoplar acceso operativo al onboarding de pagos completo.

## 10. Checklist de aceptacion (DoD)

- [ ] Owner puede crear negocio y operar en menos de 5 minutos.
- [ ] Staff puede entrar con invitacion o codigo sin OAuth obligatorio.
- [ ] Usuario sin OAuth vinculado puede operar segun rol.
- [ ] Errores de acceso son accionables y no ambiguos.
- [ ] Auditoria registra invite/redeem/login/context-switch.
- [ ] Revocar membresia invalida acceso operativo inmediatamente.
