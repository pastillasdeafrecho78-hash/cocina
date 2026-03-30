#!/usr/bin/env bash
# Build usado por Vercel: aplica migraciones contra la BD de producción (DATABASE_URL en Vercel).
# En local, VERCEL no está definido: solo generate + next build (sin tocar la BD remota).
set -euo pipefail

# Solo en deploy de producción (no en previews) para no exigir migraciones duplicadas ni tocar la BD equivocada.
if [ "${VERCEL:-}" = "1" ] && [ "${VERCEL_ENV:-}" = "production" ]; then
  echo ">>> prisma migrate deploy (Vercel production)"
  npx prisma migrate deploy
fi

echo ">>> prisma generate"
npx prisma generate

echo ">>> next build"
exec npx next build
