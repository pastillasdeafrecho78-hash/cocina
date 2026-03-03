# Checklist de Pruebas Fiscales CFDI 4.0 (Restaurante)

## Cómo usar este checklist

Para cada caso:

1. **Captura venta** → genera CFDI (o global/complemento/cancelación según aplique)
2. **Verifica**:
   - ✅ Timbrado exitoso (UUID)
   - ✅ XML contiene campos correctos
   - ✅ PDF consistente con XML
   - ✅ Registro interno guarda folio/serie/UUID/estatus
   - ✅ Si aplica: acuse de cancelación / relación UUID / complemento

**Recomendación**: Guarda un "expediente" por caso (XML, PDF, request/response PAC, logs).

---

## A. Facturación Individual (Cliente con Datos)

### Caso 1 — Persona Física, PUE Efectivo, IVA 16%

**Configuración:**
- Receptor: RFC persona física, nombre exacto, CP, régimen, Uso CFDI editable (prueba G03)
- Pago: Método PUE, Forma "01 - Efectivo"
- Conceptos: 1 producto con objetoImp "02", IVA 16%

**Validar:**
- ✅ Timbrado OK
- ✅ LugarExpedicion = CP de expedición
- ✅ Impuestos por concepto calculados correctamente
- ✅ XML sin errores

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 2 — Persona Moral, PUE Tarjeta, IVA 16%

**Configuración:**
- Receptor moral (RFC 12 caracteres)
- Método PUE, Forma "04 - Tarjeta de crédito"
- 2 conceptos gravados

**Validar:**
- ✅ Mismo que caso 1
- ✅ Datos receptor moral correctos
- ✅ RFC con 12 caracteres

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 3 — Uso CFDI Distinto (S01) con Receptor Real

**Configuración:**
- Receptor cualquiera
- Cambiar Uso CFDI de G03 a S01

**Validar:**
- ✅ Que el sistema lo permita (editable)
- ✅ Timbrado OK
- ✅ Si tu validación detecta incompatibilidad, que avise antes de timbrar (no después)

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 4 — Rechazo por Nombre No Exacto (Prueba de Soporte)

**Configuración:**
- Mismo RFC/CP/régimen, pero nombre con una variación (ej: "Juan" vs "Juan Carlos")

**Esperado:**
- ⚠️ El sistema bloquea timbrado o advierte "Nombre no coincide"
- ❌ No debería permitir timbrar "a ciegas" si tu política es evitar rechazos

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 5 — Rechazo por CP Incorrecto del Receptor

**Configuración:**
- CP distinto al del receptor (ej: CP inválido o fuera de rango)

**Esperado:**
- ⚠️ Bloqueo/advertencia previa
- ❌ No permite timbrar con CP inválido

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 6 — Validación Régimen ↔ Uso CFDI (Incompatibilidad)

**Configuración:**
- Escoge un régimen del receptor y un uso que no corresponda (según tu tabla de compatibilidades)
- Ejemplo: Régimen 616 (Sin obligaciones) con Uso G03 (Gastos en general)

**Esperado:**
- ⚠️ Bloqueo/advertencia previa
- ❌ No permite timbrar con combinación incompatible

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

## B. Impuestos por Concepto (ObjetoImp + IVA/IEPS)

### Caso 7 — Producto Exento / No Objeto

**Configuración:**
- Producto con objetoImp "01" o "03" (según tu catálogo y regla)
- Sin IVA

**Validar:**
- ✅ No se agregue IVA
- ✅ XML consistente (sin traslados indebidos)
- ✅ Importe correcto

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 8 — Mixto: Gravado + Exento en Misma Factura

**Configuración:**
- Concepto 1: IVA 16% (objetoImp 02)
- Concepto 2: exento/no objeto (objetoImp 01 o 03)

**Validar:**
- ✅ Impuestos solo en el concepto gravado
- ✅ Totales correctos
- ✅ XML sin contradicciones

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 9 — IEPS (Si el Restaurante Vende Alcohol u Otro con IEPS)

**Configuración:**
- Concepto con IEPS + IVA (si aplica en tu regla)
- Ejemplo: Bebida alcohólica con IEPS 30% + IVA 16%

**Validar:**
- ✅ IEPS calculado con tasa correcta
- ✅ IVA calculado conforme a tu criterio fiscal configurado
- ✅ XML sin contradicciones

**Nota:** Si el restaurante no maneja IEPS, este caso sirve para comprobar que tu sistema no "lo mete por error".

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

## C. Propina (Política Configurable)

### Caso 10 — Propina NO Facturable

**Configuración:**
- `propinaFacturar = false`
- Agrega propina en el ticket

**Validar:**
- ✅ Propina NO aparece en CFDI
- ✅ Total CFDI coincide con subtotal sin propina
- ✅ El sistema registra propina internamente (si así lo diseñaste), pero fuera del CFDI

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 11 — Propina Facturable como Concepto Separado

**Configuración:**
- `propinaFacturar = true`
- `propinaObjetoImp` definido (según política)

**Validar:**
- ✅ Propina aparece como concepto separado
- ✅ ObjetoImp de propina se respeta
- ✅ Impuestos coherentes (si causa o no causa según tu configuración)

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

## D. Método/Forma de Pago y Complemento (PPD)

### Caso 12 — PUE + Forma de Pago Real (No "99")

**Configuración:**
- Método PUE
- FormaPago "01 - Efectivo" o "04 - Tarjeta"

**Validar:**
- ✅ Que el sistema NO permita FormaPago "99" si tu regla fiscal lo bloquea
- ✅ Timbrado OK con forma de pago real

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 13 — PPD con 1 Complemento de Pago

**Configuración:**
- Factura inicial: Método PPD (y forma de pago según tu política)
- Luego registrar 1 pago total con complemento

**Validar:**
- ✅ CFDI inicial timbra OK (PPD)
- ✅ Complemento de pago timbra OK
- ✅ Relación correcta con el UUID original
- ✅ Montos y saldos correctos

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 14 — PPD con 2 Pagos Parciales (Múltiples Complementos)

**Configuración:**
- 2 complementos (pago parcial 1 y 2)

**Validar:**
- ✅ Saldos correctos en cada complemento
- ✅ Último pago deja saldo en 0
- ✅ No permite exceder el total
- ✅ Relaciones UUID correctas

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

## E. Factura Global (Público en General)

### Caso 15 — Global Diaria (Periodicidad Correcta)

**Configuración:**
- Receptor: XAXX010101000
- Nombre "PÚBLICO EN GENERAL"
- Régimen receptor 616, Uso S01
- CP receptor = LugarExpedicion
- Periodicidad/mes/año correctos

**Validar:**
- ✅ Timbrado OK
- ✅ Campos de global presentes y correctos
- ✅ Total global coincide con ventas no facturadas individualmente

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

## F. Global → Nominativa (Cliente Pide Factura Después)

### Caso 16 — Cliente Pide Factura Después de Estar Incluido en Global

**Configuración:**
- Depende de tu política, pero debes probar el flujo elegido:
  - Opción A: Emitir nominativa con datos del cliente
  - Opción B: Ajustar/cancelar lo global según política (si aplica)

**Validar:**
- ✅ Que el sistema no genere duplicidad sin control
- ✅ Que quede traza (ticket/folio original → nominativa → acciones sobre global)
- ✅ Política documentada y aplicada consistentemente

**Nota:** Define tu política antes de probar este caso.

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

## G. Cancelaciones y Sustitución

### Caso 17 — Cancelación Motivo 02/03/04 (Según Aplique)

**Configuración:**
- Cancelar CFDI timbrado con motivo

**Validar:**
- ✅ Acuse/estatus de cancelación
- ✅ `fechaCancelacion` guardada
- ✅ El CFDI ya no se pueda "reusar" como vigente
- ✅ Estado cambia a "cancelada"

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

### Caso 18 — Cancelación Motivo 01 con Sustitución (UUID)

**Configuración:**
- Emitir CFDI A
- Emitir CFDI B "correcto"
- Cancelar CFDI A con motivo 01 y `uuidSustitucion = UUID de B`

**Validar:**
- ✅ Relación correcta
- ✅ Timbrado/cancelación sin errores
- ✅ Trazabilidad completa
- ✅ UUID de sustitución guardado

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

## H. Nota de Crédito (CFDI Egreso) (Si lo Soportas)

### Caso 19 — Nota de Crédito Parcial (Bonificación)

**Configuración:**
- CFDI original (Ingreso)
- Emitir Egreso relacionado por parte del importe

**Validar:**
- ✅ Relación con UUID original
- ✅ Importes correctos
- ✅ Impuestos consistentes
- ✅ Tipo de comprobante = "E" (Egreso)

**Estado:** ⬜ Pendiente | ✅ Aprobado | ❌ Falló

---

## Criterios de "Pasa / Falla" (Rápidos)

### ✅ Pasa si:
- ✅ Timbrado OK sin warnings críticos
- ✅ XML coherente (pagos, impuestos, objetoImp, receptor)
- ✅ Totales exactos
- ✅ Serie/folio/UUID/estatus trazables
- ✅ Cancelación/complementos con relación correcta

### ❌ Falla si:
- ❌ Rechazo PAC/SAT por datos del receptor
- ❌ Impuestos mal calculados
- ❌ ObjetoImp contradictorio con impuestos
- ❌ PUE con FormaPago "99" (si tu política lo prohíbe)
- ❌ Duplicidad global/nominativa sin control
- ❌ Cancelación sin motivo/UUID sustitución cuando aplica

---

## Notas Finales

1. **Política Global → Nominativa**: Define y documenta tu política antes de probar el Caso 16.
2. **Validaciones**: Ejecuta las validaciones fiscales antes de cada timbrado.
3. **Logs**: Guarda todos los logs, XMLs y respuestas del PAC para auditoría.
4. **Sandbox**: Prueba primero en modo pruebas/sandbox del PAC antes de producción.

---

**Última actualización:** 2025-01-27
