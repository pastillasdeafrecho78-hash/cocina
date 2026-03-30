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

# Supabase exige TLS; sin ?sslmode=require Prisma puede fallar al conectar desde CI/Vercel.
# Si sigue P1001 "Can't reach" hacia db.*.supabase.co, usa en DIRECT_URL la URI "Session pooler" :5432
# (usuario postgres.PROJECT_REF en host aws-*.pooler.supabase.com) — ver env.example.
ensure_supabase_sslmode() {
  local url="$1"
  case "$url" in
    *supabase.co*|*supabase.com*) ;;
    *) printf '%s' "$url"; return ;;
  esac
  case "$url" in
    *sslmode=*|*ssl=* ) printf '%s' "$url"; return ;;
  esac
  case "$url" in
    *\?*) printf '%s' "${url}&sslmode=require" ;;
    *) printf '%s' "${url}?sslmode=require" ;;
  esac
}

# Solo en deploy de producción (no en previews) para no exigir migraciones duplicadas ni tocar la BD equivocada.
if [ "${VERCEL:-}" = "1" ] && [ "${VERCEL_ENV:-}" = "production" ]; then
  echo ">>> prisma migrate deploy (Vercel production)"
  MU="$(migrate_db_url)"
  if [ -n "$MU" ]; then
    MU="$(ensure_supabase_sslmode "$MU")"
    # No imprimir la URL; solo pista para depurar (6543 = pooler, suele colgar migrate).
    case "$MU" in
      *:6543*|*pooler*) echo "WARN: :6543 es pooler transaccional; migrate suele fallar. Usa db.*:5432 o session pooler :5432." ;;
      *) echo "migrate: URL para migraciones (longitud ${#MU} caracteres)." ;;
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
