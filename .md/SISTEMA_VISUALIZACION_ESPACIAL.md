# Sistema de Visualización Espacial de Mesas

## 📋 Resumen

Se ha implementado un sistema de visualización espacial que permite ver y organizar las mesas del restaurante en su acomodo real dentro del espacio físico. El sistema es **compatible con smartphones, tablets y PCs**.

## 🎯 Características Implementadas

### ✅ Sistema Manual (Implementado)

1. **Canvas Interactivo**: Planta del restaurante donde puedes arrastrar y soltar mesas
2. **Modo Edición**: Activa/desactiva el modo de edición para reposicionar mesas
3. **Zoom y Pan**: Controla el zoom y desplázate por el canvas
4. **Rotación**: Doble clic en una mesa para rotarla 90 grados
5. **Persistencia**: Las posiciones se guardan en la base de datos
6. **Responsive**: Funciona en móviles con soporte táctil

### 🔄 Sistema con Sensores del Teléfono (Opcional - Parcialmente Implementado)

**Dificultad: MEDIA-ALTA** ⚠️

El uso de sensores del teléfono para mapeo automático tiene las siguientes consideraciones:

#### Ventajas:
- ✅ Permite mapear el espacio caminando
- ✅ Más intuitivo para usuarios
- ✅ Puede usar acelerómetro, giroscopio y magnetómetro

#### Desafíos Técnicos:

1. **Deriva del Sensor**: Los sensores IMU (Inertial Measurement Unit) acumulan error con el tiempo
   - **Solución**: Requiere calibración frecuente y puntos de referencia
   - **Complejidad**: Media-Alta

2. **Permisos del Navegador**: 
   - `DeviceOrientationEvent` y `DeviceMotionEvent` requieren HTTPS
   - Algunos navegadores requieren gestos del usuario para activar
   - **Complejidad**: Media

3. **Precisión Limitada**:
   - Sin puntos de referencia externos (beacons, WiFi), la precisión es baja
   - Error típico: 1-3 metros después de 10-20 pasos
   - **Complejidad**: Alta

4. **Calibración Necesaria**:
   - El usuario debe marcar puntos de referencia (esquinas del cuarto)
   - Requiere un paso de calibración inicial
   - **Complejidad**: Media

#### Implementación Recomendada (Híbrida):

```typescript
// Estrategia recomendada:
1. Usuario marca esquinas del cuarto (calibración)
2. Usuario camina con el teléfono, el sistema calcula posición aproximada
3. Usuario ajusta manualmente la posición final de cada mesa
4. Sistema guarda coordenadas finales
```

**Nivel de Dificultad**: ⭐⭐⭐ (3/5)
- Requiere conocimiento de sensores móviles
- Necesita algoritmos de filtrado (Kalman filter recomendado)
- Requiere pruebas extensivas en diferentes dispositivos

## 🚀 Cómo Usar el Sistema Actual

### 1. Acceder a la Planta del Restaurante

- Ve a **Dashboard → Mesas → Ver Planta**
- O navega directamente a `/dashboard/mesas/planta`

### 2. Modo Edición

1. Haz clic en **"✎ Editar Posiciones"**
2. **Arrastra** las mesas a sus posiciones reales
3. **Doble clic** en una mesa para rotarla
4. Haz clic en **"💾 Guardar"** para persistir los cambios

### 3. Visualización

- **Zoom**: Usa la rueda del mouse o los botones ➖/➕
- **Pan**: Arrastra el canvas cuando esté en modo edición
- **Clic en mesa**: Si no estás en modo edición, abre la comanda de la mesa

### 4. En Móviles

- **Touch**: Funciona igual que el arrastre con mouse
- **Zoom**: Pinch to zoom (nativo del navegador)
- **Rotación**: Doble tap en una mesa

## 📊 Estructura de Datos

### Campos Agregados a la Tabla `Mesa`:

```prisma
posicionX       Float?    // Posición X en el plano (0-1000 píxeles)
posicionY       Float?    // Posición Y en el plano (0-800 píxeles)
rotacion        Float?    // Rotación en grados (0-360)
```

## 🔧 Instalación y Migración

### Paso 1: Actualizar la Base de Datos

```bash
# Generar el cliente de Prisma con los nuevos campos
npm run db:generate

# Aplicar los cambios a la base de datos
npm run db:push

# O crear una migración formal
npm run db:migrate
```

### Paso 2: Verificar

Las mesas existentes tendrán `posicionX` y `posicionY` como `null`. Al abrir la planta por primera vez, se les asignarán posiciones aleatorias que puedes ajustar.

## 🎨 Personalización

### Ajustar Dimensiones del Canvas

En `app/dashboard/mesas/planta/page.tsx`:

```typescript
const CANVAS_WIDTH = 1000  // Ancho del espacio (ajusta según tu restaurante)
const CANVAS_HEIGHT = 800  // Alto del espacio
```

### Cambiar Tamaño de las Mesas

Busca el estilo de la mesa (línea ~400):

```typescript
style={{
  width: '60px',   // Ancho de la representación de la mesa
  height: '60px',  // Alto de la representación de la mesa
}}
```

## 🔮 Mejoras Futuras (Opcionales)

### 1. Sistema de Mapeo con Sensores (Completo)

**Esfuerzo estimado**: 2-3 semanas

Implementación completa con:
- Calibración de puntos de referencia
- Filtro de Kalman para reducir deriva
- Integración con pedómetro
- Visualización en tiempo real mientras caminas

### 2. Beacons Bluetooth

**Esfuerzo estimado**: 1-2 semanas + hardware

- Requiere beacons físicos (estimado $20-50 USD cada uno)
- Precisión: 1-2 metros
- Requiere configuración inicial de beacons

### 3. AR (Realidad Aumentada)

**Esfuerzo estimado**: 4-6 semanas

- Usa WebXR o bibliotecas como AR.js
- Permite ver las mesas superpuestas en la cámara
- Requiere permisos de cámara y sensores

### 4. Mapeo con WiFi Positioning

**Esfuerzo estimado**: 2-3 semanas

- Usa puntos de acceso WiFi conocidos
- Precisión: 3-5 metros
- Requiere mapeo inicial de puntos de acceso

## 📱 Compatibilidad

### Navegadores Soportados:

- ✅ Chrome/Edge (Android, Windows, macOS)
- ✅ Safari (iOS, macOS) - con limitaciones en sensores
- ✅ Firefox (Android, Windows, macOS)
- ⚠️ Sensores: Requieren HTTPS y gestos del usuario

### Dispositivos:

- ✅ Smartphones (Android, iOS)
- ✅ Tablets
- ✅ PCs/Laptops
- ✅ Touchscreens

## 🐛 Solución de Problemas

### Las mesas no se mueven

1. Verifica que estés en **modo edición**
2. Asegúrate de hacer clic directamente en la mesa
3. En móviles, verifica que el touch esté funcionando

### Las posiciones no se guardan

1. Verifica la conexión a internet
2. Revisa la consola del navegador para errores
3. Verifica que tengas permisos de administrador

### El canvas está vacío

1. Verifica que tengas mesas creadas
2. Recarga la página
3. Verifica la consola para errores de API

## 💡 Recomendaciones

1. **Para uso inicial**: Usa el sistema manual (arrastrar y soltar)
2. **Para precisión**: Marca puntos de referencia físicos en el restaurante
3. **Para móviles**: El sistema táctil funciona bien, pero es más fácil en tablets
4. **Para producción**: Considera agregar beacons si necesitas alta precisión

## 📚 Referencias Técnicas

- [DeviceOrientationEvent API](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent)
- [DeviceMotionEvent API](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent)
- [WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)
- [Kalman Filter para tracking](https://en.wikipedia.org/wiki/Kalman_filter)

---

**¿Preguntas?** El sistema manual es completamente funcional y recomendado para la mayoría de casos de uso. El sistema con sensores es opcional y requiere desarrollo adicional significativo.
