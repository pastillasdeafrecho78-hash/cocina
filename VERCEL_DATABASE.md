# Base de datos en Vercel (Supabase)

**IMPORTANTE:** Usa siempre el puerto **6543** (pooler). El 5432 puede causar errores 500 en serverless.

1. En Supabase: **Project Settings → Database → Connection string**
2. Elige **Transaction pooler** (modo transacción)
3. Copia la URL (puerto **6543**)
4. En Vercel: **Project → Settings → Environment Variables** → `DATABASE_URL`

```
postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

El puerto **6543** es esencial para Vercel serverless. No cambies a 5432.

## JWT_SECRET (obligatorio)

Añade `JWT_SECRET` en Vercel (mínimo 16 caracteres). Si falta, aparecerán 401 en todas las APIs.

1. Genera un secreto: `openssl rand -base64 32` o usa https://generate-secret.vercel.app/32
2. En Vercel: Environment Variables → `JWT_SECRET` = (tu secreto)

Para verificar: visita `https://tu-app.vercel.app/api/health` y revisa que `jwt` sea `"ok"`.
