#!/usr/bin/env bash
# Build usado por Vercel: migraciones deben ir por conexión directa a Postgres (Supabase :5432).
# Si usas solo el pooler (:6543 / PgBouncer), migrate deploy puede colgarse o fallar.
# Configura DIRECT_URL en Vercel (misma cadena que "Direct connection" en Supabase).
# En local, VERCEL no está definido: solo generate + next build (sin tocar la BD remota).
set -euo pipefail

# Solo en deploy de producción (no en previews) para no exigir migraciones duplicadas ni tocar la BD equivocada.
if [ "${VERCEL:-}" = "1" ] && [ "${VERCEL_ENV:-}" = "production" ]; then
  echo ">>> prisma migrate deploy (Vercel production)"
  if [ -n "${DIRECT_URL:-}" ]; then
    DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
  else
    echo "WARN: DIRECT_URL vacío; usando DATABASE_URL (si es pooler Supabase, el migrate puede colgarse)."
    npx prisma migrate deploy
  fi
fi

echo ">>> prisma generate"
npx prisma generate

echo ">>> next build"
exec npx next build
