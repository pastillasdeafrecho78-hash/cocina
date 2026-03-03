# 📝 Configuración del Proyecto - Recordatorio Importante

Este archivo contiene las configuraciones específicas de este proyecto para referencia rápida en futuros chats y agentes.

---

## 🗄️ Configuración de Base de Datos PostgreSQL

### Información General

- **Servidor PostgreSQL**: Un solo servidor PostgreSQL real corriendo en `localhost:5432`
- **Servidores en pgAdmin**: Se configuraron DOS "servidores" en pgAdmin (son solo etiquetas/conexiones):
  - **"laboratorio local"**: Conexión para la aplicación de laboratorio
  - **"POS"**: Conexión para esta aplicación de comandas

### ⚠️ IMPORTANTE: ¿Por qué ambos "servidores" muestran las mismas bases de datos?

**Respuesta**: NO hay conflicto. Esto es completamente normal.

**🔍 Aclaración fundamental:**

- Los **"servidores"** en pgAdmin **NO son servidores PostgreSQL reales**
- Son solo **etiquetas/conexiones** para organizarte en pgAdmin
- El **servidor PostgreSQL REAL** es un proceso que corre en tu computadora en el puerto `5432`
- **Solo hay UN servidor PostgreSQL REAL** instalado en tu sistema

**¿Por qué ambos muestran las mismas bases de datos?**

Porque ambos "servidores" en pgAdmin ("laboratorio local" y "POS") apuntan al **MISMO puerto (5432)**, que es donde corre el **servidor PostgreSQL REAL**.

```
┌─────────────────────────────────────────────┐
│  Servidor PostgreSQL REAL (localhost:5432)  │
│  ─────────────────────────────────────────  │
│  • postgres (base de datos por defecto)     │
│  • laboratorio_comandas                     │
│  • comandas_db                              │
└─────────────────────────────────────────────┘
            ↑                    ↑
            │                    │
    ┌───────┴────────┐    ┌──────┴────────┐
    │ "laboratorio   │    │ "POS"         │
    │  local"        │    │ (pgAdmin)     │
    │ (pgAdmin)      │    │               │
    │                │    │               │
    │ Host: localhost│    │ Host: localhost│
    │ Port: 5432     │    │ Port: 5432    │
    └────────────────┘    └───────────────┘
    (Solo etiquetas, ambos apuntan al mismo servidor real)
```

**Conclusión:**
- ✅ Hay **UN solo servidor PostgreSQL REAL** (puerto 5432)
- ✅ Hay **DOS "servidores" en pgAdmin** (solo etiquetas para organizarte)
- ✅ Ambos "servidores" en pgAdmin apuntan al mismo servidor PostgreSQL REAL
- ✅ Por eso ambos muestran las mismas bases de datos

Las bases de datos que aparecen son:
  - `postgres` - Base de datos por defecto de PostgreSQL (se crea automáticamente)
  - `laboratorio_comandas` - Base de datos de la aplicación de laboratorio
  - `comandas_db` - Base de datos de esta aplicación de comandas

### Base de Datos Específica: `comandas_db`

- **Nombre**: `comandas_db`
- **Servidor en pgAdmin**: "POS" (es solo una etiqueta para organización)
- **Configuración de creación**:
  - **Encoding**: `UTF8`
  - **Collation**: `English_United States.1252`
  - **Character Type**: `English_United States.1252`
  - **Template**: `template1`
  - **Owner**: `postgres`

### Conexión

- **Host**: `localhost`
- **Port**: `5432`
- **Username**: `postgres`
- **Password**: (Configurada en `.env.local`)
- **Connection String**: `postgresql://postgres:PASSWORD@localhost:5432/comandas_db`

---

## 🔑 Variables de Entorno

El archivo `.env.local` contiene:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/comandas_db"
JWT_SECRET="TU_JWT_SECRET_AQUI"
```

---

## 📋 Notas Importantes

1. **Mismo Servidor PostgreSQL**: Esta aplicación comparte el mismo servidor PostgreSQL con otra aplicación ("laboratorio local"). Esto es una práctica estándar y eficiente. Cada aplicación usa su propia base de datos.

2. **No hay conflictos**: Que ambos "servidores" en pgAdmin muestren las mismas bases de datos es normal. Es el comportamiento esperado cuando múltiples conexiones apuntan al mismo servidor PostgreSQL.

3. **Collation**: Se usó `English_United States.1252` en lugar de dejarlo vacío porque:
   - Está en Windows en inglés
   - Evita errores de incompatibilidad
   - Funciona perfectamente con el template1

4. **Para desarrollo futuro**: Si necesitas crear otra base de datos:
   - Puedes usar la misma conexión "POS" en pgAdmin
   - O crear otra conexión con un nombre diferente
   - Pero todas apuntan al mismo servidor PostgreSQL (puerto 5432)

---

## 🛠️ Comandos Útiles

```bash
# Verificar variables de entorno
npm run verify:env

# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Poblar con datos iniciales
npm run db:seed
```

---

## 📖 Documentación Completa

Para instrucciones detalladas paso a paso, ver: `CONFIGURACION_INICIAL.md`

---

**Última actualización**: Configuración realizada con PostgreSQL usando collation `English_United States.1252` en Windows.

