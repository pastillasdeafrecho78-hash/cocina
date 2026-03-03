# APIs Externas para Validaciones Fiscales

Este documento explica cómo usar APIs externas para mejorar las validaciones fiscales del sistema.

## 📋 Resumen

El sistema incluye validaciones locales (formato, catálogos estáticos), pero puedes integrar APIs externas para:

1. **Validar RFC contra el SAT** - Verificar que el RFC esté activo y pueda emitir/recibir CFDI
2. **Validar Código Postal** - Verificar que el CP existe y obtener estado/municipio/colonias
3. **Sincronizar Catálogos SAT** - Mantener catálogos actualizados automáticamente

**Importante:** Estas APIs son **opcionales**. Si no están configuradas, el sistema usa validaciones locales como fallback.

---

## 🔧 Configuración

### Variables de Entorno

Agrega estas variables a tu `.env.local`:

```env
# Validación de RFC contra el SAT
API_VALIDACION_RFC_URL=https://api.ejemplo.com
API_VALIDACION_RFC_KEY=tu_api_key

# Validación de Código Postal (COPOMEX)
COPOMEX_API_TOKEN=tu_token_copomex

# Catálogos SAT actualizados
API_CATALOGOS_SAT_URL=https://api.fiscalapi.com/api/v4/catalogs
```

---

## 1. Validación de RFC contra el SAT

### ¿Qué hace?

Verifica que el RFC:
- ✅ Esté activo en el SAT
- ✅ Pueda emitir CFDI
- ✅ Pueda recibir CFDI
- ✅ Obtiene razón social y régimen fiscal del SAT

### APIs Disponibles

#### Opción 1: FacturoPorti (Recomendada)
- **URL**: `https://developers.facturoporti.com.mx`
- **Costo**: Requiere cuenta (consulta precios)
- **Ventaja**: Validación directa contra el SAT
- **Endpoint**: `POST /validar-rfc`

#### Opción 2: Servicio Propio
Si tienes acceso directo al SAT, puedes crear tu propio servicio.

### Uso en el Código

```typescript
import { validarRFCMejorado } from '@/lib/apis-validacion-externa'

// Validación con API (si está configurada)
const resultado = await validarRFCMejorado('REST123456ABC', true, true)

if (!resultado.valido) {
  console.error('Errores:', resultado.errores)
}

if (resultado.datosSAT) {
  console.log('RFC activo:', resultado.datosSAT.activo)
  console.log('Razón social SAT:', resultado.datosSAT.razonSocial)
}
```

### Respuesta de la API

```typescript
{
  rfc: 'REST123456ABC',
  activo: true,
  puedeEmitir: true,
  puedeRecibir: true,
  razonSocial: 'RESTAURANTE EJEMPLO S.A. DE C.V.',
  regimenFiscal: '601',
  fechaAlta: '2020-01-15',
  fechaUltimoCambio: '2023-06-20'
}
```

---

## 2. Validación de Código Postal

### ¿Qué hace?

Verifica que el código postal:
- ✅ Existe en SEPOMEX
- ✅ Obtiene estado, municipio, colonias asociadas
- ✅ Valida que la colonia sea correcta

### APIs Disponibles

#### Opción 1: COPOMEX (Recomendada)
- **URL**: `https://api.copomex.com`
- **Costo**: Gratis (50 consultas iniciales), luego requiere créditos
- **Registro**: `https://api.copomex.com/registro`
- **Endpoint**: `GET /query/info_cp/{codigoPostal}?token={token}`

#### Opción 2: SEPOMEX Static API (Alternativa)
- **URL**: `https://sepomex.nitrostudio.com.mx/api/v1/codigo_postal/{cp}`
- **Costo**: Gratis
- **Ventaja**: Sin registro necesario
- **Desventaja**: Menos información que COPOMEX

### Uso en el Código

```typescript
import { validarCodigoPostalMejorado } from '@/lib/apis-validacion-externa'

// Validación con API (si está configurada)
const resultado = await validarCodigoPostalMejorado('01000', true)

if (resultado.datosCP) {
  console.log('Estado:', resultado.datosCP.estado)
  console.log('Municipio:', resultado.datosCP.municipio)
  console.log('Colonias:', resultado.datosCP.colonias)
}
```

### Respuesta de la API

```typescript
{
  codigoPostal: '01000',
  estado: 'Ciudad de México',
  municipio: 'Álvaro Obregón',
  colonias: ['Centro', 'San Ángel', 'Tlacopac'],
  asentamientos: [...],
  valido: true
}
```

---

## 3. Sincronización de Catálogos SAT

### ¿Qué hace?

Mantiene los catálogos SAT actualizados automáticamente:
- ✅ Regímenes Fiscales
- ✅ Usos CFDI
- ✅ Formas de Pago
- ✅ Métodos de Pago
- ✅ Periodicidades

### APIs Disponibles

#### Opción 1: FiscalAPI
- **URL**: `https://api.fiscalapi.com/api/v4/catalogs`
- **Costo**: Requiere cuenta (consulta precios)
- **Ventaja**: Actualización automática, formato JSON

#### Opción 2: Repositorios GitHub
- **Repositorio**: `bambucode/catalogos_sat_JSON`
- **Costo**: Gratis
- **Ventaja**: Actualización en tiempo real desde el SAT
- **Desventaja**: Requiere descargar y procesar archivos

### Uso en el Código

```typescript
import { sincronizarCatalogosSAT, obtenerCatalogoSATActualizado } from '@/lib/apis-validacion-externa'

// Sincronizar todos los catálogos
const resultado = await sincronizarCatalogosSAT()
console.log('Actualizados:', resultado.actualizados)
console.log('Fallidos:', resultado.fallidos)

// Obtener un catálogo específico
const regimenes = await obtenerCatalogoSATActualizado('regimenes')
if (regimenes) {
  console.log(`Regímenes disponibles: ${regimenes.length}`)
}
```

---

## 🔄 Flujo de Validación Mejorada

```
┌─────────────────────────────────────┐
│  Usuario ingresa RFC                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  1. Validación Local (Formato)       │
│     - Longitud correcta              │
│     - Formato regex                  │
└──────────────┬──────────────────────┘
               │
               ▼
         ¿Válido?
               │
        ┌──────┴──────┐
        │             │
       NO            SÍ
        │             │
        ▼             ▼
   ❌ Error    ┌──────────────────────┐
               │ 2. Validación API     │
               │    (si configurada)  │
               │    - RFC activo      │
               │    - Puede emitir     │
               │    - Puede recibir    │
               └──────────┬───────────┘
                          │
                          ▼
                    ¿Válido?
                          │
                   ┌──────┴──────┐
                   │             │
                  NO            SÍ
                   │             │
                   ▼             ▼
              ❌ Error      ✅ Aprobado
```

---

## 📝 Ejemplo Completo

```typescript
import {
  validarRFCMejorado,
  validarCodigoPostalMejorado,
  verificarConfiguracionAPIs,
} from '@/lib/apis-validacion-externa'

async function validarDatosFiscales(rfc: string, codigoPostal: string) {
  // Verificar si las APIs están configuradas
  const config = verificarConfiguracionAPIs()
  console.log('APIs configuradas:', config)

  // Validar RFC
  const validacionRFC = await validarRFCMejorado(
    rfc,
    true, // esPersonaMoral
    config.rfc // usarAPI si está configurada
  )

  if (!validacionRFC.valido) {
    return {
      valido: false,
      errores: validacionRFC.errores,
    }
  }

  // Validar Código Postal
  const validacionCP = await validarCodigoPostalMejorado(
    codigoPostal,
    config.codigoPostal // usarAPI si está configurada
  )

  if (!validacionCP.valido) {
    return {
      valido: false,
      errores: validacionCP.errores,
    }
  }

  // Si hay datos del SAT, mostrarlos
  if (validacionRFC.datosSAT) {
    console.log('Datos del SAT:', validacionRFC.datosSAT)
  }

  if (validacionCP.datosCP) {
    console.log('Datos del CP:', validacionCP.datosCP)
  }

  return {
    valido: true,
    advertencias: [
      ...validacionRFC.advertencias,
      ...validacionCP.advertencias,
    ],
  }
}
```

---

## 🚀 Integración en el Sistema

### Opción 1: Usar en Validaciones Existentes

Modifica `lib/validaciones-fiscales.ts` para usar las APIs cuando estén disponibles:

```typescript
import { validarRFCMejorado } from './apis-validacion-externa'

// En lugar de:
// const validacion = validarRFC(rfc, esPersonaMoral)

// Usar:
const validacion = await validarRFCMejorado(rfc, esPersonaMoral, true)
```

### Opción 2: Endpoint API para Validación en Tiempo Real

Crea `app/api/validaciones/rfc/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { validarRFCMejorado } from '@/lib/apis-validacion-externa'

export async function POST(request: NextRequest) {
  const { rfc, esPersonaMoral } = await request.json()
  
  const resultado = await validarRFCMejorado(rfc, esPersonaMoral, true)
  
  return NextResponse.json(resultado)
}
```

---

## ⚠️ Consideraciones

### Fallback Automático

Si las APIs no están configuradas o fallan, el sistema **automáticamente** usa validaciones locales. No bloquea el flujo.

### Límites de Uso

- **COPOMEX**: 50 consultas gratis, luego requiere créditos
- **FacturoPorti**: Requiere cuenta de pago
- **FiscalAPI**: Requiere cuenta de pago

### Rate Limiting

Implementa caché para evitar exceder límites:

```typescript
// Ejemplo de caché simple (en memoria)
const cacheRFC = new Map<string, { resultado: any; timestamp: number }>()

async function validarRFCConCache(rfc: string) {
  const cached = cacheRFC.get(rfc)
  const ahora = Date.now()
  
  // Cache válido por 24 horas
  if (cached && (ahora - cached.timestamp) < 24 * 60 * 60 * 1000) {
    return cached.resultado
  }
  
  const resultado = await validarRFCMejorado(rfc, true, true)
  cacheRFC.set(rfc, { resultado, timestamp: ahora })
  
  return resultado
}
```

---

## 📚 Recursos

- **COPOMEX**: https://api.copomex.com/documentacion
- **FacturoPorti**: https://developers.facturoporti.com.mx
- **FiscalAPI**: https://docs.fiscalapi.com
- **Catálogos SAT JSON**: https://github.com/bambucode/catalogos_sat_JSON
- **SEPOMEX Static**: https://sepomex.nitrostudio.com.mx/docs

---

## ✅ Checklist de Implementación

- [ ] Registrar cuenta en COPOMEX y obtener token
- [ ] (Opcional) Configurar API de validación RFC
- [ ] (Opcional) Configurar API de catálogos SAT
- [ ] Agregar variables de entorno a `.env.local`
- [ ] Probar validaciones con APIs
- [ ] Implementar caché si es necesario
- [ ] Documentar para el equipo

---

**Nota:** Las validaciones locales siempre funcionan. Las APIs externas son una mejora opcional para mayor precisión.
