# Base de datos en Vercel (Supabase)

Para que el login funcione en producción, usa la **cadena del pooler de transacciones** (puerto 6543), no la conexión directa (5432).

1. En Supabase: **Project Settings → Database → Connection string**
2. Elige **Transaction pooler** (modo transacción)
3. Copia la URL (puerto **6543**)
4. En Vercel: **Project → Settings → Environment Variables**
5. Añade o edita `DATABASE_URL` con esa URL

La URL debe verse similar a:
```
postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

O con el host antiguo:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:6543/postgres
```

El puerto **6543** es esencial para serverless; el 5432 puede dar errores de conexión.
