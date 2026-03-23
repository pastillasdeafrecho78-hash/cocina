# Configuración del restaurante — UX, UI y contenido

Documento orientado a **producto, diseño y contenido** (no técnico). Describe la pantalla **`/dashboard/configuracion`** y cómo se relaciona con el resto del sistema.

---

## 1. Propósito de la página

- **Objetivo principal:** dejar listo el **restaurante como emisor fiscal** (CFDI 4.0) y la **operación de pagos y mesas**.
- **Público:** usuario con permiso **Configuración** (típicamente administrador / quien hace el alta inicial).
- **Mensaje rector (cabecera):** configuración inicial de facturación del restaurante (emisor), para CFDI válidos (individuales y globales), alineados con SAT.

---

## 2. Marco visual y patrones de UI

| Elemento | Descripción |
|----------|-------------|
| **Layout** | Fondo gris claro (`gray-50`), contenedor centrado ancho máximo ~4xl, tarjeta blanca con sombra y bordes redondeados. |
| **Jerarquía** | Título grande (H1) + subtítulo gris + bloques de paso con fondo azul muy suave (`blue-50`) y borde azul claro. |
| **Modo** | Toggle segmentado **Fácil** / **Avanzado** (estilo pill: activo azul sólido, inactivo blanco). |
| **Progreso** | Indicador de **pasos numerados en círculos** unidos por línea; el paso actual y anteriores en azul, futuros en gris. |
| **Formularios** | Etiquetas encima, inputs con borde gris y foco azul; rejilla responsive 1 col móvil / 2 cols escritorio. |
| **Ayudas** | Textos `text-xs` grises bajo campos; cajas de advertencia **amarillo/naranja** para temas fiscales sensibles (propina, factura global → nominativa). |
| **Navegación inferior** | **Anterior** (gris, deshabilitado en paso 1) + **Siguiente** (azul) o **Guardar configuración completa** (verde en último paso). |
| **Feedback** | Toasts de éxito/error al guardar; al terminar el último paso se redirige al **dashboard**. |

**Preferencia de modo:** se guarda en `localStorage` (`configuracion_modo_facil`): al volver, se recuerda Fácil vs Avanzado.

---

## 3. Modo **Fácil** (configuración básica)

**Idea UX:** pocas decisiones del negocio; el sistema completa el resto con **valores por defecto** razonables para restaurante (comprobante tipo ingreso, MXN, IVA 16 %, redondeo, etc.).

**Pasos en el indicador:** 3 — etiquetas resumidas: *Datos + Lugar*, *Decisiones*, *PAC y más*.

### Paso 1 — Datos del emisor + lugar de expedición (misma pantalla)

**Bloque A — Datos fiscales obligatorios**

- Copy: datos exactos como en SAT; obligatorios para CFDI válidos.
- Campos: **RFC**, **Régimen fiscal** (select catálogo SAT), **Nombre o razón social**, **CP domicilio fiscal**, **Calle**, **Nº exterior**, **Nº interior** (opcional), **Colonia**, **Municipio**, **Estado**, **País** (MEX, fijo).

**Bloque B — Lugar de expedición y foliado**

- Copy: CP del establecimiento que emite; puede diferir del domicilio fiscal (sucursal/caja).
- Campos: **CP lugar de expedición**, **Serie de factura** (ej. A, POS), **Folio inicial** (consecutivo; ayuda: se incrementa solo).

### Paso 2 — Decisiones clave

- Copy: factura global, propina y uso CFDI; el resto por defecto.
- **Factura global:** checkbox habilitar ventas sin datos del cliente.
- **Uso CFDI (global):** select acotado (ej. S01, G03, P01) + nota de validación con régimen.
- **Propina:** checkbox “Facturar propina como concepto”.
- Cierre: texto ámbar invitando a **Modo Avanzado** si necesitan más opciones.

### Paso 3 — PAC, CSD, pagos y tiempos

- Copy: datos para timbrar y operar; mismos requisitos que en avanzado.
- **PAC:** API Key (password), modo Pruebas / Producción.
- **CSD:** rutas servidor a `.cer` y `.key`, contraseña del certificado.
- **Conekta:** Private Key y Public Key (password).
- **Tiempos mesas:** minutos para estado **amarillo** y **rojo** (semáforo en vista de mesas).

---

## 4. Modo **Avanzado** (configuración completa)

**Idea UX:** control total para **contador o admin**; cada bloque fiscal en su paso.

**Pasos:** 9 — nombres en el stepper: *Datos Fiscales* → *Lugar Expedición* → *Comprobante* → *Fiscal Operativa* → *PAC* → *CSD* → *Factura Global* → *Pagos* → *Tiempos*.

### Paso 1 — Datos fiscales

Igual que en Fácil (bloque emisor); validación explícita de RFC.

### Paso 2 — Lugar de expedición y serie/folio

Igual que en Fácil (bloque B).

### Paso 3 — Comprobante

- Tipo de comprobante, exportación, moneda, tipo de cambio (si no es MXN).

### Paso 4 — Fiscal operativa

- Precios con/sin IVA, tasas IVA 16 % / 0 %, IEPS, descuentos antes de impuestos, política de redondeo.
- **Propina:** caja amarilla “Importante fiscal” (contador); radio **No facturar propina** vs **Facturar como concepto** + objeto de impuesto si aplica.

### Paso 5 — PAC

- API Key PAC, modo pruebas/producción; enlace conceptual al proveedor.

### Paso 6 — CSD

- Rutas `.cer` / `.key`, contraseña; referencia a descarga en SAT.

### Paso 7 — Factura global

- Habilitar, RFC/nombre/régimen receptor genérico, uso CFDI, periodicidad, mes/año opcionales.
- **Política global → nominativa:** caja naranja (cliente pide factura después); select de política (emitir sin ajustar / cancelar global / ajustar con nota de crédito) + recomendación contable.

### Paso 8 — Pagos (Conekta)

- Private y Public Key; enlace a Conekta.

### Paso 9 — Tiempos de mesas

- Misma lógica que Fácil paso 3; copy explica verde / amarillo / rojo según minutos.

---

## 5. Comportamiento de navegación y guardado

- Cada **Siguiente** envía solo el **fragmento del paso actual** al servidor (guardado incremental).
- **Último paso:** botón verde “Guardar configuración completa” y redirección al dashboard.
- **Anterior** no pierde datos ya guardados en pasos previos (se recargan al entrar de nuevo).

---

## 6. Relación con el resto del producto

| Contexto | Comportamiento |
|----------|----------------|
| **Dashboard** | Tarjeta “Configuración”: muestra ✓ o “!” según `configuracionCompleta`; aviso amarillo si falta PAC o Conekta con CTA a esta página. |
| **Permisos** | Sin permiso `configuracion`, la API solo expone **tiempos de mesas** (ej. pantalla estado de mesas puede ajustar tiempos vía otra ruta). |
| **Multi-restaurante** | La configuración es **por restaurante** (tenant); cada sesión ve solo la de su `restauranteId`. |
| **Clip (PinPad)** | **No está en esta página.** Las credenciales y terminales Clip viven en **Caja** → sección “Cobro con Clip”. |

---

## 7. Recomendaciones de contenido / microcopy (mejoras posibles)

1. En **Modo Fácil**, si el paso 1 muestra lugar de expedición, asegurar que el usuario entienda que **debe guardar con “Siguiente”** para persistir también ese bloque (o unificar mensaje “Este paso guarda datos del emisor y de expedición”).
2. Reforzar en paso 3 Fácil que **Conekta es opcional** solo si el negocio no usa tarjeta/OXXO desde el POS (hoy el formulario lo marca requerido).
3. Añadir en cabecera un enlace “¿Solo quieres cambiar tiempos de mesas?” → deep link a **Estado de mesas** si existe flujo reducido.

---

## 8. Resumen una línea

| Modo | Usuario | Contenido |
|------|---------|-----------|
| **Fácil** | Dueño / arranque rápido | Emisor + expedición + 3 decisiones + credenciales técnicas en un solo cierre. |
| **Avanzado** | Contador / TI | 9 pasos desglosados: comprobante, operación fiscal, PAC, CSD, global, pagos, tiempos. |

---

*Última revisión alineada con `app/dashboard/configuracion/page.tsx`.*
