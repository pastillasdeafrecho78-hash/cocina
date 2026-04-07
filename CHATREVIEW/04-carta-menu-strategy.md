# Menu multisucursal V2

## Estado actual util

- `EMPTY`: menu local vacio.
- `CLONE`: snapshot local independiente.
- `SHARED`: lectura desde fuente (`menuSourceRestauranteId`) y bloqueo de escritura en consumidor.

Esto debe mantenerse durante la transicion por compatibilidad.

## Limitacion a resolver

`SHARED` comparte todo el arbol. No permite:

- Asignar solo parte del menu fuente.
- Cambiar precio/disponibilidad por sucursal sin romper herencia.
- Tener una lectura "menu efectivo" unica entre dashboard y canal publico.

## Propuesta de datos V2

1. `MenuCatalogItem`: entidad canonica de carta (categoria/producto/modificador).
2. `MenuAssignment`: que items canonicos aplica una sucursal.
3. `MenuOverride`: override por sucursal (`precio`, `disponible`, `activo`, `orden`).

## Reglas de lectura

1. Resolver sucursal operativa.
2. Resolver fuente de catalogo (si aplica).
3. Cargar items asignados (`MenuAssignment`) para la sucursal.
4. Aplicar overrides (`MenuOverride`).
5. Devolver menu efectivo a dashboard y API publica con el mismo servicio.

## Reglas de escritura

- Editar catalogo base: solo desde sucursal fuente con `menu.manage`.
- Editar overrides: desde sucursal destino con `menu.manage`.
- En modo legacy SHARED, mantener 409 para escritura directa sobre carta heredada.
- `CLONE` se mantiene como accion explicita "desacoplar y copiar snapshot".

## Evolucion recomendada de estrategias

Mantener enum actual por ahora y mapear semanticamente:

- `EMPTY` -> local.
- `CLONE` -> local desacoplado.
- `SHARED` -> heredado (futuro: parcial + overrides).

Cuando V2 este estable, renombrar hacia modos mas expresivos (`LOCAL`, `INHERITED`, `HYBRID`) sin romper APIs externas.
