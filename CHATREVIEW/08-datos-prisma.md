# Modelo de datos Prisma/PostgreSQL V2 (concreto)

## Cambios recomendados sobre tablas actuales

### `Usuario`

- Mantener: `id`, `email`, `nombre`, `apellido`, `password`, `activo`.
- Mantener: `activeRestauranteId`, `activeOrganizacionId`.
- Legacy temporal: `restauranteId`, `rolId`.
- Objetivo: `email` unico global.

### `SucursalMiembro`

- Agregar: `rolId String?`.
- Constraint: `@@unique([usuarioId, restauranteId])`.
- Indices: `@@index([restauranteId, activo])`, `@@index([usuarioId, activo])`.

### `OrganizacionMiembro`

- Agregar: `rolId String?` (opcional, para governance organizacional).
- Constraint: `@@unique([usuarioId, organizacionId])`.

## Tablas nuevas para menu V2

### `MenuCatalogItem`

- `id`
- `sourceRestauranteId`
- `entityType` (`CATEGORIA`, `PRODUCTO`, `MODIFICADOR`)
- `sourceEntityId` (id de entidad actual)
- `activo`
- `createdAt`, `updatedAt`

Constraint recomendado: `@@unique([sourceRestauranteId, entityType, sourceEntityId])`

### `MenuAssignment`

- `id`
- `restauranteId` (destino)
- `menuCatalogItemId`
- `activo`
- `createdAt`, `updatedAt`

Constraint recomendado: `@@unique([restauranteId, menuCatalogItemId])`

### `MenuOverride`

- `id`
- `restauranteId` (destino)
- `menuCatalogItemId`
- `precioOverride Decimal?`
- `disponibleOverride Boolean?`
- `activoOverride Boolean?`
- `ordenOverride Int?`
- `updatedByUserId`
- `updatedAt`

Constraint recomendado: `@@unique([restauranteId, menuCatalogItemId])`

## Campos a deprecar (no eliminar al inicio)

- `Usuario.rolId`
- `Usuario.restauranteId`
- Uso funcional de `Restaurante.menuStrategy` como unico mecanismo de sharing

## Nota sobre permisos

`Rol.permisos` puede mantenerse como JSON durante transicion, pero se recomienda normalizar a tabla puente (`RolPermiso`) cuando termine la migracion de asignacion por sucursal.
