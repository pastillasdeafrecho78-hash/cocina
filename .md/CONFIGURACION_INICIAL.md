# 🚀 Configuración Inicial: Base de Datos y JWT Secret

Guía paso a paso para configurar PostgreSQL con pgAdmin 4 y generar el JWT_SECRET.

---

## 🎯 ¿Tienes Múltiples Aplicaciones? (Lee esto primero)

Si ya tienes otra aplicación usando PostgreSQL, aquí está la **mejor práctica**:

### ✅ **OPCIÓN RECOMENDADA: Mismo Servidor, Bases de Datos Diferentes**

**Lo que debes hacer:**
- ✅ Usar el **mismo servidor PostgreSQL** (puerto 5432)
- ✅ Crear una **base de datos diferente** para cada aplicación
- ✅ En pgAdmin, puedes crear una nueva conexión (con un nombre diferente como "POS") que apunte al mismo servidor

**Ejemplo:**
- **App 1**: Base de datos `mi_app_db` → conexión en pgAdmin llamada "Mi App"
- **App 2 (esta)**: Base de datos `comandas_db` → conexión en pgAdmin llamada "POS"
- **Ambas** usan el mismo servidor PostgreSQL en `localhost:5432`

**Ventajas:**
- ✅ Más eficiente (un solo proceso de PostgreSQL)
- ✅ Más fácil de mantener (una sola instalación)
- ✅ Menos consumo de recursos
- ✅ Es la práctica estándar en la industria

### ❌ **NO Recomendado: Múltiples Instancias de PostgreSQL**

- ❌ Instalar otra instancia de PostgreSQL en otro puerto (ej: 5433)
- ❌ Esto consume más recursos y es innecesario para desarrollo local

---

## 📋 Paso 1: Configurar Base de Datos en pgAdmin 4

### 1.1 Abrir pgAdmin 4

1. Abre pgAdmin 4 desde el menú de inicio o escritorio
2. La primera vez que lo abras, te pedirá crear una **contraseña maestra** para pgAdmin
   - Esta contraseña es SOLO para pgAdmin, NO es la de PostgreSQL
   - Anótala en un lugar seguro
   - Si ya la creaste antes, solo ingrésala

### 1.2 Crear el Servidor PostgreSQL

#### **Opción A: Si NO tienes ningún servidor configurado en pgAdmin**

1. En el panel izquierdo, busca **"Servers"** (está en la parte superior)
2. Haz **clic derecho** en **"Servers"**
3. Selecciona **"Register"** → **"Server..."**

4. Se abrirá una ventana. Configura así:

   **📌 Pestaña "General":**
   - **Name**: Escribe `PostgreSQL` (o el nombre que prefieras, ej: "Mi Servidor Local")
   - **Server group**: Déjalo en "Servers"
   - **Comments**: (Opcional) Puedes dejarlo vacío

   **📌 Pestaña "Connection" (LA MÁS IMPORTANTE):**
   - **Host name/address**: Escribe `localhost`
   - **Port**: `5432` (este es el puerto por defecto de PostgreSQL)
   - **Maintenance database**: Escribe `postgres` (esta es la base de datos por defecto)
   - **Username**: Escribe `postgres` (usuario por defecto de PostgreSQL)
   - **Password**: Aquí va tu **contraseña de PostgreSQL** (la que configuraste al instalar PostgreSQL)
     - ⚠️ **IMPORTANTE**: Si no recuerdas tu contraseña de PostgreSQL, tendrás que resetearla
   - ✅ **Marca la casilla "Save password"** (para que no te la pida cada vez)

   **📌 Pestaña "SSL" (Opcional):**
   - Déjala como está (no necesitas cambiar nada para desarrollo local)

5. Haz clic en el botón **"Save"** (abajo a la derecha)

#### **Opción B: Si YA tienes otra aplicación usando PostgreSQL (RECOMENDADO)**

Si ya tienes otra aplicación configurada en pgAdmin, puedes:

**Opción B1: Usar la misma conexión existente (Más simple)**
- ✅ Expande tu servidor existente en pgAdmin
- ✅ Ve directamente al **Paso 1.4** para crear la nueva base de datos `comandas_db`
- ✅ No necesitas crear otra conexión

**Opción B2: Crear una nueva conexión con nombre diferente (Para organizarte mejor)**
- ✅ Crea una nueva conexión en pgAdmin con nombre "POS" (o el que prefieras)
- ✅ **IMPORTANTE**: Usa los **mismos datos de conexión** que tu otra app:
  - Host: `localhost`
  - Port: `5432` (el mismo puerto)
  - Username: `postgres` (o el mismo usuario)
  - Password: La misma contraseña
- ✅ Esto crea una "etiqueta" diferente en pgAdmin, pero se conecta al **mismo servidor PostgreSQL**
- ✅ Luego ve al **Paso 1.4** para crear la base de datos `comandas_db`

**💡 ¿Por qué esto es mejor?**
- Ambas aplicaciones usan el mismo servidor PostgreSQL (más eficiente)
- Cada aplicación tiene su propia base de datos (aislamiento de datos)
- No necesitas instalar otra instancia de PostgreSQL
- Es la práctica estándar en desarrollo

**Ejemplo práctico:**
- Tu app anterior: conexión "Mi App" → base de datos `mi_app_db`
- Esta nueva app: conexión "POS" → base de datos `comandas_db`
- Ambas en el mismo servidor PostgreSQL (`localhost:5432`)

6. Si hay un error al crear la conexión, revisa:
   - Que PostgreSQL esté instalado y corriendo
   - Que la contraseña sea correcta
   - Que el puerto 5432 no esté bloqueado

### 1.3 Conectar al Servidor

1. Una vez creado el servidor, verás que tiene un ícono de servidor en el panel izquierdo
2. Si el servidor tiene un **candado cerrado** 🔒, haz **clic derecho** sobre él → **"Connect Server"**
3. Si te pide contraseña, ingresa la contraseña de PostgreSQL (no la de pgAdmin)
4. Si todo está bien, el candado se abrirá 🔓 y podrás expandir el servidor

### 1.4 Crear la Base de Datos

1. Una vez conectado al servidor, **expande** el servidor haciendo clic en la flecha ▶️
2. Verás varias carpetas: Databases, Login/Group Roles, etc.
3. Haz **clic derecho** en **"Databases"** (NO en el servidor, sino en la carpeta "Databases")
4. Selecciona **"Create"** → **"Database..."**

5. Se abrirá una ventana. Tienes varias pestañas:

   **📌 Pestaña "General":**
   - **Database**: Escribe `comandas_db` (este será el nombre de tu base de datos)
   - **Owner**: Selecciona `postgres` del menú desplegable (o déjalo como está)
   - **Comments**: (Opcional) Puedes escribir "Base de datos para sistema de comandas"

   **📌 Pestaña "Definition" (IMPORTANTE):**
   - **Encoding**: Déjalo en `UTF8` (por defecto)
   - **Collation**: 
     - ✅ **Opción 1 (Recomendada)**: Déjalo **VACÍO** - PostgreSQL usará automáticamente la collation por defecto del sistema (que es la correcta)
     - ✅ **Opción 2 (Windows en inglés)**: Usa `English_United States.1252` - Es la collation estándar para Windows en inglés
     - ❌ **NO uses `C`** - puede causar error de incompatibilidad
   - **Character Type**: 
     - ✅ **Si dejaste Collation vacío**: Déjalo también **VACÍO** - usará la misma collation que el campo anterior automáticamente
     - ✅ **Si usaste Collation `English_United States.1252`**: Usa también `English_United States.1252` aquí (deben coincidir)
   - **Template**: Déjalo en `template1` (por defecto). Solo cámbialo a `template0` si sigues teniendo errores de collation
   
   💡 **Ejemplo práctico (Windows en inglés)**: 
   - **Collation**: `English_United States.1252`
   - **Character Type**: `English_United States.1252`
   - Ambos campos deben tener el mismo valor si los especificas manualmente.
   
   💡 **Resumen**: Puedes dejarlo vacío (PostgreSQL lo manejará) o especificar `English_United States.1252` en ambos campos si estás en Windows en inglés. Ambas opciones funcionan correctamente.

   **📌 Pestaña "Security" (Opcional):**
   - No necesitas cambiar nada aquí

6. Haz clic en el botón **"Save"** (abajo a la derecha)

7. Si todo está bien, verás que `comandas_db` aparece en la lista de bases de datos bajo "Databases"

✅ **¡Listo!** Ya tienes la base de datos `comandas_db` creada.

### 1.5 Verificar que la Base de Datos Funciona

1. Expande **"Databases"** (haz clic en la flecha ▶️)
2. Deberías ver `comandas_db` en la lista
3. Haz **clic derecho** en `comandas_db` → **"Query Tool"**
4. Se abrirá una ventana con un editor de texto
5. Escribe este comando SQL:
   ```sql
   SELECT version();
   ```
6. Haz clic en el botón de ejecutar (⚡) en la barra de herramientas, o presiona `F5`
7. En la parte inferior deberías ver la versión de PostgreSQL (ej: "PostgreSQL 14.x...")

✅ Si ves la versión, todo está funcionando correctamente.

### 1.6 Verificar qué Collation está usando la Base de Datos (Opcional)

Si dejaste vacío el campo de Collation y quieres saber qué collation se está usando automáticamente:

1. Con la base de datos `comandas_db` seleccionada en pgAdmin, abre el **Query Tool** (clic derecho → "Query Tool")
2. Ejecuta este comando SQL:
   ```sql
   SELECT datname, datcollate, datctype 
   FROM pg_database 
   WHERE datname = 'comandas_db';
   ```
3. Haz clic en ejecutar (⚡ o `F5`)
4. Verás una tabla con:
   - **datname**: El nombre de tu base de datos (`comandas_db`)
   - **datcollate**: La collation que está usando (ej: `English_United States.1252`)
   - **datctype**: El tipo de caracteres (normalmente igual a datcollate)

**Alternativa más simple:**
- Haz **clic derecho** en `comandas_db` → **"Properties"**
- Ve a la pestaña **"Definition"**
- Ahí verás la Collation y Character Type que se están usando

💡 **Nota**: Esta verificación es opcional. Si la base de datos se creó sin errores, la collation está correcta y no necesitas preocuparte por esto.

---

## 🔐 Paso 2: Generar JWT_SECRET

### Opción A: PowerShell (Windows)

1. Abre **PowerShell** (no CMD)
2. Copia y pega este comando:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

3. Presiona Enter
4. Copia el resultado (será algo como: `aBc123XyZ456...`)

### Opción B: Generador Online (Rápido)

1. Ve a: https://generate-secret.vercel.app/32
2. Copia el secreto generado

### Opción C: Manual (Si las anteriores no funcionan)

Crea una cadena aleatoria de al menos 32 caracteres. Puedes usar:
- Letras mayúsculas y minúsculas
- Números
- Algunos caracteres especiales (evita comillas)

Ejemplo: `MiClaveSecretaSuperSegura12345678901234567890`

---

## 📝 Paso 3: Configurar .env.local

1. Abre tu archivo `.env.local` en la raíz del proyecto
2. Configúralo así:

```env
# Base de datos
# Reemplaza: postgres con tu usuario, password con tu contraseña
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/comandas_db"

# Autenticación JWT
# Pega aquí el JWT_SECRET que generaste
JWT_SECRET="TU_JWT_SECRET_AQUI"
```

### Ejemplo Real:

Si tu usuario es `postgres`, tu contraseña es `mipassword123`, y tu JWT_SECRET es `aBc123XyZ456...`, quedaría:

```env
# Base de datos
DATABASE_URL="postgresql://postgres:mipassword123@localhost:5432/comandas_db"

# Autenticación JWT
JWT_SECRET="aBc123XyZ456DeF789GhI012JkL345MnO678PqR901StU234VwX567YzA890"
```

---

## ✅ Paso 4: Verificar Configuración

### 4.1 Verificar Variables de Entorno

Ejecuta en la terminal (en la raíz del proyecto):

```bash
npm run verify:env
```

Deberías ver:
```
✅ DATABASE_URL Configurado correctamente
✅ JWT_SECRET Configurado correctamente
```

### 4.2 Probar Conexión a Base de Datos

```bash
npx prisma db pull
```

Si funciona, verás un mensaje de éxito. Si da error, revisa:
- Que PostgreSQL esté corriendo
- Que la base de datos `comandas_db` exista
- Que el usuario y contraseña sean correctos

---

## 🎯 Paso 5: Crear las Tablas (Primera Vez)

Una vez que la conexión funciona:

```bash
# 1. Generar el cliente Prisma
npm run db:generate

# 2. Crear las tablas en la base de datos
npm run db:migrate

# Cuando te pida un nombre para la migración, escribe: init
```

### 5.1 Verificar que las Tablas se Crearon

1. En pgAdmin 4, en el panel izquierdo:
   - Expande tu servidor ▶️
   - Expande **"Databases"** ▶️
   - Expande **`comandas_db`** ▶️
   - Expande **"Schemas"** ▶️
   - Expande **"public"** ▶️
   - Expande **"Tables"** ▶️

2. Deberías ver una lista de tablas como:
   - `Usuario`
   - `Mesa`
   - `Comanda`
   - `ComandaItem`
   - `Producto`
   - `Categoria`
   - `Modificador`
   - etc.

✅ Si ves las tablas, las migraciones funcionaron correctamente.

---

## 🌱 Paso 6: Poblar con Datos Iniciales (Opcional)

Para crear usuarios de prueba y datos iniciales:

```bash
npm run db:seed
```

Esto creará:
- Usuario admin: `admin@restaurante.com` / `admin123`
- Usuario mesero: `mesero@restaurante.com` / `mesero123`
- Usuario cocinero: `cocinero@restaurante.com` / `cocinero123`
- 12 mesas
- Categorías y productos de ejemplo

---

## 🔍 Ver Datos en pgAdmin 4

1. En pgAdmin 4, en el panel izquierdo:
   - Expande tu servidor ▶️
   - Expande **"Databases"** ▶️
   - Expande **`comandas_db`** ▶️
   - Expande **"Schemas"** ▶️
   - Expande **"public"** ▶️
   - Expande **"Tables"** ▶️

2. Haz **clic derecho** en una tabla (ej: `Usuario`) → **"View/Edit Data"** → **"All Rows"**

3. Se abrirá una ventana con los datos en formato de tabla (como Excel)

4. Si ejecutaste el seed (`npm run db:seed`), deberías ver:
   - En la tabla `Usuario`: 3 usuarios (admin, mesero, cocinero)
   - En la tabla `Mesa`: 12 mesas
   - En la tabla `Producto`: 6 productos
   - etc.

---

## ❓ Solución de Problemas

### Error: "password authentication failed"

**Problema**: La contraseña en `DATABASE_URL` es incorrecta.

**Solución**: 
1. Verifica tu contraseña en pgAdmin 4
2. Actualiza `DATABASE_URL` en `.env.local`

### Error: "database does not exist"

**Problema**: La base de datos `comandas_db` no existe.

**Solución**: 
1. Vuelve al Paso 1.4 y crea la base de datos

### Error: "new collation (C) is incompatible with the collation of the template database"

**Problema**: La collation `C` no es compatible con la collation de tu template database (ej: `English_United States.1252`).

**Solución**: 
1. En la ventana de crear base de datos, ve a la pestaña **"Definition"**
2. En el campo **"Collation"**: 
   - ✅ **Opción 1 (Recomendada)**: Déjalo **VACÍO** - PostgreSQL usará automáticamente la collation correcta del sistema
   - ✅ **Opción 2 (Windows en inglés)**: Usa `English_United States.1252` - Funciona perfectamente si estás en Windows en inglés
3. En el campo **"Character Type"**: 
   - ✅ **Si dejaste Collation vacío**: Déjalo también **VACÍO** - usará la misma collation automáticamente
   - ✅ **Si usaste `English_United States.1252` en Collation**: Usa también `English_United States.1252` aquí (deben ser iguales)
4. Si aún da error, cambia **"Template"** de `template1` a `template0`
5. Haz clic en **"Save"**

✅ **Configuración que funciona**: 
- **Collation**: `English_United States.1252`
- **Character Type**: `English_United States.1252`
- Ambos campos con el mismo valor funcionan perfectamente en Windows en inglés.

### Error: "connection refused" o "could not connect to server"

**Problema**: PostgreSQL no está corriendo.

**Solución**:
1. Presiona `Windows + R` para abrir "Ejecutar"
2. Escribe: `services.msc` y presiona Enter
3. Busca en la lista un servicio que diga **"postgresql"** o **"PostgreSQL"**
4. Si dice "Detenido", haz clic derecho → **"Iniciar"**
5. Espera a que el estado cambie a "En ejecución"
6. Vuelve a pgAdmin 4 e intenta conectar de nuevo

**Alternativa rápida:**
- Busca "Services" en el menú de inicio de Windows
- Busca PostgreSQL y inícialo

### Error: "JWT_SECRET is too short"

**Problema**: El JWT_SECRET tiene menos de 32 caracteres.

**Solución**: Genera uno nuevo con el método del Paso 2

---

## 📋 Checklist Final

- [ ] pgAdmin 4 abierto y contraseña maestra configurada
- [ ] Servidor PostgreSQL creado y conectado en pgAdmin 4
- [ ] PostgreSQL está corriendo (verificado en Services)
- [ ] Base de datos `comandas_db` creada en pgAdmin 4
- [ ] Puedo ejecutar queries en `comandas_db` (SELECT version() funciona)
- [ ] JWT_SECRET generado (mínimo 32 caracteres)
- [ ] `.env.local` configurado con `DATABASE_URL` y `JWT_SECRET`
- [ ] `npm run verify:env` muestra todo correcto
- [ ] `npx prisma db pull` funciona
- [ ] `npm run db:generate` ejecutado sin errores
- [ ] `npm run db:migrate` ejecutado sin errores
- [ ] Puedo ver las tablas en pgAdmin 4 (en Schemas → public → Tables)
- [ ] `npm run db:seed` ejecutado (opcional, pero recomendado)

---

**¡Listo!** Ya tienes todo configurado. Ahora puedes empezar a desarrollar. 🎉

