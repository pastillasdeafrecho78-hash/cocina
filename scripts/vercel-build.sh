#!/usr/bin/env bash
# Build usado por Vercel: migraciones deben ir por conexión directa a Postgres (Supabase :5432).
# Si usas solo el pooler (:6543 / PgBouncer), migrate deploy puede colgarse o fallar.
# Configura DIRECT_URL en Vercel (misma cadena que "Direct connection" en Supabase).
# En local, VERCEL no está definido: solo generate + next build (sin tocar la BD remota).
set -euo pipefail

# URL para migraciones: prioridad DIRECT_URL, luego nombres que usa la integración Supabase↔Vercel o plantillas.
migrate_db_url() {
  [ -n "${DIRECT_URL:-}" ] && printf '%s' "${DIRECT_URL}" && return
  [ -n "${POSTGRES_URL_NON_POOLING:-}" ] && printf '%s' "${POSTGRES_URL_NON_POOLING}" && return
  [ -n "${POSTGRES_PRISMA_URL:-}" ] && printf '%s' "${POSTGRES_PRISMA_URL}" && return
  printf ''
}

# Solo en deploy de producción (no en previews) para no exigir migraciones duplicadas ni tocar la BD equivocada.
if [ "${VERCEL:-}" = "1" ] && [ "${VERCEL_ENV:-}" = "production" ]; then
  echo ">>> prisma migrate deploy (Vercel production)"
  MU="$(migrate_db_url)"
  if [ -n "$MU" ]; then
    # No imprimir la URL; solo pista para depurar (6543 = pooler, suele colgar migrate).
    case "$MU" in
      *:6543*|*pooler*) echo "WARN: la URL de migrate apunta a :6543/pooler; usa URI directa :5432 (db.*.supabase.co)." ;;
      *) echo "migrate: URL directa detectada (longitud ${#MU} caracteres)." ;;
    esac
    DATABASE_URL="$MU" npx prisma migrate deploy
  else
    echo "WARN: sin DIRECT_URL (ni POSTGRES_URL_NON_POOLING / POSTGRES_PRISMA_URL). Vercel no está inyectando la variable en ESTE deploy."
    echo "      En Vercel: revisa que exista para Production, guarda, luego Redeploy (ideal: Clear build cache)."
    echo "      Usando DATABASE_URL (si es pooler :6543, migrate puede colgarse)."
    npx prisma migrate deploy
  fi
fi

echo ">>> prisma generate"
npx prisma generate

echo ">>> next build"
exec npx next build
