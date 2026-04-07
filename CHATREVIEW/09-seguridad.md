# Seguridad y autorizacion: matriz de riesgos

## Principio

`middleware.ts` autentica, pero la seguridad real tenant-scoped depende de cada handler. Por eso la mitigacion principal es estandarizar guardas de autorizacion y scoping.

## Matriz priorizada

| Riesgo | Ejemplo tipico | Impacto | Mitigacion recomendada | Prioridad |
|---|---|---|---|---|
| Sesion sin permiso | `POST /api/...` valida login pero no `*.manage` | Escalada de privilegios interna | `requireCapability()` obligatorio en mutaciones | Alta |
| Cross-tenant por scoping | Query por ID sin validar membresia del tenant activo | Exfiltracion o corrupcion entre sucursales | `requireTenantMembership()` + `requireResourceScope()` | Alta |
| Tenant inyectado por cliente | Handler usa `restauranteId` del body/query | Escritura en sucursal incorrecta | Derivar tenant solo del contexto servidor | Alta |
| Escritura indebida en herencia de menu | Consumidor modifica menu fuente | Cambios globales involuntarios | Bloqueo 409 + verificacion de ownership de fuente | Alta |
| Roles ambiguos por legacy | `Usuario.rolId` aplicado a todas las sucursales | Permisos excesivos o insuficientes | Migrar a `SucursalMiembro.rolId` por fases | Alta |
| Exposicion de secretos | API keys/tokens en logs | Compromiso de integraciones | Hash, redaccion de logs, rotacion periodica | Media |
| JWT stale | Membresia cambia y token no refleja de inmediato | Ventana de autorizacion inconsistente | Revalidacion server-side y versionado de sesion | Media |
| Falsa confianza en RLS | Asumir que RLS reemplaza autorizacion app | Bypass por rol de app privilegiado | Mantener checks de aplicacion siempre | Media |

## Reglas operativas obligatorias

1. Ninguna mutacion tenant-scoped sin capacidad explicita.
2. Ninguna mutacion por ID sin validar pertenencia del recurso al tenant.
3. Ninguna ruta publica sin validaciones de estado/tenant equivalentes.
4. Todo cambio destructivo con doble confirmacion y auditoria.

## Guardrails recomendados

- Feature flags para migracion de authz.
- Logs estructurados de denegaciones (`403`) y fallback legacy.
- Alertas por intentos cross-tenant.
- Pruebas de seguridad por modulo (auth, carta, publico, integraciones).
