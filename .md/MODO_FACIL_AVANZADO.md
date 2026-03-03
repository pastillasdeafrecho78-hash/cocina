# Modo Fácil / Modo Avanzado

Mismo motor fiscal (config + validaciones + facturación). Dos capas de UI.

## Toggle global

- **Fácil**: pocas decisiones, resto por defecto. Tipo “Soft Restaurant”.
- **Avanzado**: configuración completa (contador/admin).

La preferencia se guarda en `localStorage` (`configuracion_modo_facil`).

---

## Configuración

### Modo Fácil (3 pasos)

1. **Datos + Lugar**: datos fiscales y lugar de expedición en una sola pantalla.
2. **Decisiones**: factura global (sí/no), uso CFDI por defecto, propina (no facturar / facturar). El resto usa valores por defecto.
3. **PAC y más**: PAC, CSD, Conekta, tiempos de mesas.

### Modo Avanzado (9 pasos)

Flujo actual completo (datos fiscales, lugar, comprobante, fiscal, PAC, CSD, factura global, Conekta, tiempos).

---

## Emisión (timbrar)

### Asistente de facturación (Modo Fácil)

Componente: `components/AsistenteFacturacion.tsx`.

- **Paso 1**: ¿Global o nominativa?
- **Paso 2**: ¿Cómo se pagó? (presets: mostrador/domicilio/plataforma, PUE/PPD, efectivo/tarjeta/transferencia). Uso CFDI editable.
- **Paso 3**: Propina (no facturar / facturar / usar política). Vista previa y **Timbrar**.

Presets en `lib/presets-fiscales.ts`. Se resuelven con `resolverPresetEmision(presetId, overrides)`.

### Modo Avanzado

Formulario completo de emisión (receptor, forma/método de pago, etc.) donde aplique.

---

## API

- **POST /api/pagos**  
  Opcional en el body:
  - `formaPago`, `metodoPago`, `esFacturaGlobal`: overrides desde el asistente.
  - `detallesEmision`: `{ modo: 'facil', presetId, overrides, timestamp }` para auditoría.

Se persiste en `Factura.detallesEmision` cuando se emite con asistente.

---

## Reglas

- No se duplican reglas: mismo backend, mismas validaciones.
- Modo Fácil no permite incoherencias; si falta algo crítico, se bloquea o se pide el dato.
- Log de decisiones: siempre que se use Modo Fácil en emisión, se guarda preset + overrides en la factura.
