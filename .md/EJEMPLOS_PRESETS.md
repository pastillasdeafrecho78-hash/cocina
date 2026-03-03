# Ejemplos de Presets Fiscales

## 📋 Resumen

Se agregaron **3 nuevos presets de ejemplo**:
- **1 Avanzado**: Para casos complejos (empresas, crédito, uso CFDI específico)
- **2 Fáciles**: Para ventas rápidas y simples

---

## 🏢 1. PRESET AVANZADO

### `AVANZADO_EMPRESA_CREDITO`

**Características:**
- **Tipo de venta**: Mostrador
- **Método de pago**: PPD (Pago en parcialidades o diferido)
- **Forma de pago**: 03 (Transferencia electrónica)
- **Uso CFDI**: G03 (Gastos en general)
- **Propina**: No se factura
- **Factura global**: No (siempre nominativa para empresas)

**Descripción:**
> Facturación a empresa con crédito (PPD), uso CFDI G03 (Gastos en general), propina no facturable. Para clientes corporativos con cuenta corriente.

**Cuándo usar:**
- Clientes corporativos con cuenta corriente
- Empresas que pagan después del consumo
- Necesitas uso CFDI G03 (gastos en general)
- Facturación nominativa obligatoria (no global)

**Ejemplo de uso:**
```typescript
const params = resolverPresetEmision('AVANZADO_EMPRESA_CREDITO', {
  // Overrides opcionales si necesitas cambiar algo
  // usoCFDI: 'G01', // Si el cliente requiere otro uso
})
// Resultado:
// {
//   metodoPago: 'PPD',
//   formaPago: '03',
//   usoCFDI: 'G03',
//   propinaFacturar: false,
//   esFacturaGlobal: false
// }
```

---

## ⚡ 2. PRESET FÁCIL #1

### `FACIL_RAPIDO_EFECTIVO`

**Características:**
- **Tipo de venta**: Mostrador
- **Método de pago**: PUE (Pago en una exhibición)
- **Forma de pago**: 01 (Efectivo)
- **Uso CFDI**: S01 (Sin efectos fiscales)
- **Propina**: No se factura
- **Factura global**: Sí (por defecto)

**Descripción:**
> Venta rápida en efectivo, factura global. Sin propina. Para servicio rápido.

**Cuándo usar:**
- Venta rápida en mostrador
- Cliente paga en efectivo al momento
- No necesita factura nominativa
- Servicio express/rápido

**Ejemplo de uso:**
```typescript
const params = resolverPresetEmision('FACIL_RAPIDO_EFECTIVO')
// Resultado:
// {
//   metodoPago: 'PUE',
//   formaPago: '01',
//   usoCFDI: 'S01',
//   propinaFacturar: false,
//   esFacturaGlobal: true
// }
```

---

## 🚚 3. PRESET FÁCIL #2

### `FACIL_DOMICILIO_TARJETA`

**Características:**
- **Tipo de venta**: Domicilio
- **Método de pago**: PUE (Pago en una exhibición)
- **Forma de pago**: 04 (Tarjeta de crédito)
- **Uso CFDI**: S01 (Sin efectos fiscales)
- **Propina**: No se factura
- **Factura global**: Sí (por defecto)

**Descripción:**
> Entrega a domicilio, pago con tarjeta. Factura global. Simple y rápido.

**Cuándo usar:**
- Pedidos a domicilio
- Cliente paga con tarjeta
- No necesita factura nominativa
- Servicio de entrega estándar

**Ejemplo de uso:**
```typescript
const params = resolverPresetEmision('FACIL_DOMICILIO_TARJETA')
// Resultado:
// {
//   metodoPago: 'PUE',
//   formaPago: '04',
//   usoCFDI: 'S01',
//   propinaFacturar: false,
//   esFacturaGlobal: true
// }
```

---

## 📊 Comparación Visual

| Preset | Complejidad | Método | Forma | Uso CFDI | Global | Propina |
|--------|-------------|--------|-------|----------|--------|---------|
| **AVANZADO_EMPRESA_CREDITO** | 🔴 Avanzado | PPD | 03 (Transferencia) | G03 | ❌ No | ❌ No |
| **FACIL_RAPIDO_EFECTIVO** | 🟢 Fácil | PUE | 01 (Efectivo) | S01 | ✅ Sí | ❌ No |
| **FACIL_DOMICILIO_TARJETA** | 🟢 Fácil | PUE | 04 (Tarjeta) | S01 | ✅ Sí | ❌ No |

---

## 🎯 Vista Previa en el Asistente

Cuando el usuario seleccione estos presets en el **Asistente de Facturación (Modo Fácil)**, verá:

### Avanzado:
```
🏢 Empresa · Crédito · Uso G03
Facturación a empresa con crédito (PPD), uso CFDI G03 (Gastos en general), propina no facturable. Para clientes corporativos con cuenta corriente.
```

### Fácil 1:
```
⚡ Rápido · Efectivo
Venta rápida en efectivo, factura global. Sin propina. Para servicio rápido.
```

### Fácil 2:
```
🚚 Domicilio · Tarjeta
Entrega a domicilio, pago con tarjeta. Factura global. Simple y rápido.
```

---

## 💡 Notas

- **Avanzado**: Requiere datos del cliente (RFC, nombre, régimen) → siempre nominativa
- **Fáciles**: Pueden usar factura global (PÚBLICO EN GENERAL) si no hay datos del cliente
- Todos los presets pueden tener **overrides** si necesitas cambiar algo específico para esa emisión
