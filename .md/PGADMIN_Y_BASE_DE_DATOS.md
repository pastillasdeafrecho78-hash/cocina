# Por qué pgAdmin a veces "no reconoce" la base de datos

## Resumen rápido

- **`npm run dev`** solo inicia la app Next.js. **No inicia ni detiene PostgreSQL**.
- **PostgreSQL** es un servicio de Windows que corre por separado (puerto 5432).
- **pgAdmin** es solo un cliente: se conecta al mismo PostgreSQL que usa la app.
- Si la base de datos "no se reconoce", suele ser por: **PostgreSQL no está corriendo**, **la base `comandas_db` no existe**, o **pgAdmin no ha refrescado la lista**.

---

## 1. Orden de las cosas (qué hace cada uno)

| Acción              | Qué hace                                      |
|---------------------|-----------------------------------------------|
| **npm run dev**     | Inicia Next.js. La app intenta conectar a la BD. |
| **Abrir pgAdmin**   | Abre el programa. No inicia PostgreSQL.      |
| **Conectar servidor en pgAdmin** | Conecta al PostgreSQL que ya está corriendo. |
| **Cerrar npm run dev** | Solo cierra Next.js. PostgreSQL sigue igual.  |

Por eso da igual si haces primero "run dev" o primero pgAdmin: **lo que importa es que el servicio PostgreSQL esté en ejecución** antes de conectar (en pgAdmin o desde la app).

---

## 2. Por qué a veces "no reconoce" la base de datos

### A) PostgreSQL no está corriendo

- Si el **servicio PostgreSQL** está detenido:
  - La app (`npm run dev`) no puede conectar y dará error de base de datos.
  - pgAdmin tampoco podrá conectar al servidor (o se desconectará).
- **Solución**: Iniciar el servicio de PostgreSQL en Windows (ver más abajo).

### B) La base de datos `comandas_db` no existe

- Puedes tener el servidor conectado en pgAdmin y solo ver la base `postgres`.
- Si **nunca creaste** la base `comandas_db`, la app intentará conectarse a una base que no existe y fallará.
- **Solución**: Crear la base `comandas_db` en pgAdmin (clic derecho en **Databases** → **Create** → **Database...** → nombre: `comandas_db`) y luego ejecutar `npm run db:push` y `npm run db:seed`.

### C) pgAdmin no refresca la lista

- A veces la base ya existe pero pgAdmin sigue mostrando la lista antigua.
- **Solución**: Clic derecho en el **servidor** o en **Databases** → **Refresh**. Deberías ver `comandas_db`.

### D) Varias instalaciones de PostgreSQL (puertos distintos)

- Si tienes más de una instalación (por ejemplo EDB en 5432 y otra en 5433), la app puede usar un puerto y pgAdmin otro.
- **Solución**: En pgAdmin revisa que **Host: localhost** y **Port: 5432** coincidan con tu `DATABASE_URL` en `.env.local` (por ejemplo `postgresql://postgres:...@localhost:5432/comandas_db`).

---

## 3. Qué hacer paso a paso cuando "no reconoce" la base

1. **Comprobar que PostgreSQL está corriendo**
   - `Win + R` → `services.msc` → Enter.
   - Buscar un servicio tipo **PostgreSQL** o **postgresql**.
   - Si está "Detenido", clic derecho → **Iniciar**.

2. **Abrir pgAdmin y conectar al servidor**
   - Conectar al servidor (localhost, puerto 5432).
   - Si no conecta, el problema es el servicio (vuelve al paso 1).

3. **Comprobar si existe `comandas_db`**
   - Expandir **Databases**.
   - Si no ves `comandas_db`, clic derecho en **Databases** → **Refresh**.
   - Si sigue sin aparecer, créala: **Create** → **Database...** → nombre: `comandas_db`, Owner: `postgres`.

4. **Crear tablas y datos iniciales (si la base está vacía)**
   - En la raíz del proyecto:
     - `npm run db:push`
     - `npm run db:seed`

5. **Comprobar que la app usa la misma conexión**
   - En `.env.local` debe estar algo como:
     - `DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/comandas_db"`
   - Mismo host, puerto y nombre de base que en pgAdmin.

---

## 4. Resumen

- **Cerrar o abrir `npm run dev` no cambia el estado de PostgreSQL ni de la base de datos.**  
- Si "no reconoce" la base: revisa **servicio PostgreSQL**, **existencia de `comandas_db`**, **Refresh en pgAdmin** y que **DATABASE_URL** coincida con lo que usas en pgAdmin.

---

## 5. Si después de "Reload env" ves 404 en /dashboard o en _next/static

Cuando Next.js recarga `.env.local` en caliente ("Reload env: .env.local"), a veces el servidor dev se desincroniza y empieza a devolver **404** en `/dashboard` y en archivos `/_next/static/...`.

**Qué hacer:**
1. Detén el servidor: en la terminal donde corre `npm run dev`, pulsa **Ctrl+C**.
2. Vuelve a arrancar: `npm run dev`.
3. En el navegador: **cierra la pestaña** de la app o haz **recarga forzada** (Ctrl+Shift+R o Ctrl+F5) y entra de nuevo a `http://localhost:3000` (o a `/login` y luego al dashboard).
