# Inventario de permisos (legacy vs capacidades) y uso en API

Documento de apoyo para el rediseño de la UI de roles. **Fuente de verdad del modelo:** `lib/permisos.ts`. **Evaluación en servidor:** `lib/authz/guards.ts` (`requireCapability`, `requireAnyCapability`) delegan en `tienePermiso`, que aplica el mapeo bidireccional legacy ↔ capacidades.

## 1. Constantes en código

| Lista | Archivo | Contenido |
| --- | --- | --- |
| `MODULOS_LEGACY` | `permisos.ts` | `mesas`, `comandas`, `carta`, `cocina`, `barra`, `reportes`, `caja`, `configuracion`, `usuarios_roles` |
| `CAPACIDADES` | `permisos.ts` | `menu.*`, `orders.*`, `kitchen.*`, `bar.*`, `payments.*`, `reports.*`, `settings.*`, `staff.*`, `reservations.*`, `tables.*`, `benefits.grant` |
| `MODULOS` | `permisos.ts` | `[...MODULOS_LEGACY, ...CAPACIDADES]` — orden usado por la UI legacy de checkboxes |
| `LEGACY_TO_CAPABILITIES` | `permisos.ts` | Qué capacidades satisface cada clave legacy |
| `CAPABILITY_TO_LEGACY` | `permisos.ts` | Qué legacy “equivale” a cada capacidad (para comprobar permisos legacy con rol solo-capabilities) |
| `PERMISSION_LABELS` | `permisos.ts` | Etiquetas para UI (incluye texto “(legacy)” en módulos viejos) |

## 2. Comportamiento en API

- `requireCapability(user, 'X')`: el usuario debe tener `X` en su array **o** una capacidad/legacy que lo implique vía `tienePermiso`.
- `requireAnyCapability(user, [a,b,...])`: basta con **uno** que cumpla `tienePermiso`.

Muchas rutas siguen pidiendo **nombres legacy** (`comandas`, `caja`, `configuracion`, `reportes`, `mesas`, `cocina`, `barra`) aunque el rol almacene solo capacidades; eso es correcto mientras `tienePermiso` expanda en ambos sentidos.

## 3. Uso por dominio (resumen de `app/api`)

Agrupación orientativa; ver cada `route.ts` para la lista exacta de claves.

### Mesas y plantas

- `app/api/mesas/route.ts`, `mesas/[id]/route.ts`, `plantas/route.ts`: `tables.view` / `tables.manage` con alternativas `mesas`, `comandas`, `reportes`, `caja`, `orders.manage` según método.
- `app/api/mesas/[id]/public-link/route.ts`: `tables.client_channel`, `mesas`.

### Configuración (tiempos, pedidos cliente)

- `configuracion/tiempos/route.ts`, `configuracion/pedidos-cliente/route.ts`: mezcla de `tables.*`, `settings.manage`, `configuracion`, `mesas`.

### Comandas y solicitudes

- `comandas/*`, `solicitudes/*`: mayormente `comandas` y capacidades `orders.*` / `orders.override`; rutas cocina/barra usan legacy `cocina` / `barra` en algunos handlers.

### Carta (menú)

- `categorias/*`, `productos/*`, `modificadores/*`: `menu.view`, `menu.manage`.

### Cocina / barra

- `comandas/cocina/route.ts` → `cocina`; `comandas/barra/route.ts` → `barra`; ítems pueden combinar `comandas` con `cocina`/`barra`.

### Caja y pagos

- `caja/*`, `pagos/*`, `clip/*` (varias): `caja`, `comandas`, `configuracion` según endpoint.

### Reportes

- `reportes/*`: `reportes` (legacy) en guards de varias rutas; capacidad `reports.view` mapea a legacy vía `tienePermiso`.

### Configuración general e identidad

- `configuracion/route.ts`, `clip/config`, `integraciones/pedidos/config`, `clip/dispositivos`, `clip/terminales`: `configuracion` o `settings.manage`.
- `auth/organization`, `auth/branches`: `settings.manage`.

### Personal y roles

- `roles/*`, `usuarios/*`, `auth/access-codes`, `auth/invites`, `auth/memberships`: `staff.manage` o `usuarios_roles` según ruta.

### Otros

- `dashboard/estadisticas/route.ts`: `requireAnyCapability` con varios legacy.
- `productos`, `reportes/query`, `facturas`, etc.: revisar grep en el repo.

## 4. Cómo actualizar este inventario

```bash
rg "requireCapability|requireAnyCapability" ServimOS/app/api -n
```

Tras añadir rutas nuevas, actualizar esta tabla o el comentario en `permission-ui-groups.ts` si afecta agrupación visual.

## 5. UI nueva (`admin/roles`)

- Agrupación y plantillas: `lib/permission-ui-groups.ts` (`PERMISSION_UI_GROUPS`, `ROLE_PRESETS`).
- La serialización del rol sigue siendo `permisos: string[]` sin transformación al guardar.
