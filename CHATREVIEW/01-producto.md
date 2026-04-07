# Producto y diagnostico operativo

## Alcance funcional real

La plataforma ya cubre el circuito operativo central de restaurantes:

- Operacion de salon (`Mesa`, `Comanda`, estados, destinos cocina/barra).
- Gestion de carta (`Categoria`, `Producto`, `ProductoTamano`, `Modificador`).
- Caja/turnos/cortes y reporteo operativo.
- Configuracion tenant, onboarding, codigos de vinculacion e integraciones.

Esto es suficiente para produccion B2B multisucursal y es una base valida para evolucion V2.

## Donde el producto esta fuerte

1. Dominio operativo bien separado por sucursal (`Restaurante`).
2. Onboarding por codigo y flujo `/acceso` resuelve entrada de staff sin friccion.
3. Soporte de tres canales de pedido (`STAFF_DASHBOARD`, `PUBLIC_LINK`, `EXTERNAL_API`).
4. Menu multisucursal con estrategia declarativa (`EMPTY`, `CLONE`, `SHARED`).
5. Cierre logico de recursos criticos (sucursal/organizacion) en lugar de borrado destructivo.

## Donde hoy se vuelve fragil para escalar

1. Identidad y autorizacion viven en capas mezcladas (`Usuario`, membresias y contexto de sesion).
2. `Usuario.rolId` no modela permisos distintos por sucursal.
3. `Usuario.restauranteId` funciona como legado y puede confundirse con tenant operativo.
4. `SHARED` acopla carta completa; no permite sharing parcial ni overrides por sucursal.
5. El middleware autentica, pero no obliga autorizacion uniforme por capacidad en todos los handlers.

## Principio rector para la V2

Separar sin ambiguedad:

- **Identidad** (quien es el usuario),
- **Pertenencia** (a que sucursales/organizaciones pertenece),
- **Autorizacion** (que puede hacer en cada sucursal),
- **Contexto activo** (donde esta operando ahora),
- **Fuente de menu** (de donde hereda el catalogo).

Esa separacion reduce incidentes cross-tenant y deuda de mantenimiento en APIs.
