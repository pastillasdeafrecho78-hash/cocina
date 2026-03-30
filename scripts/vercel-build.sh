#!/usr/bin/env bash
# Build usado por Vercel: migraciones NO pueden usar el pooler transaccional de Supabase (:6543).
# Usa DIRECT_URL = conexión directa db.*.supabase.co:5432 o Session pooler aws-*.pooler.supabase.com:5432.
# En local, VERCEL no está definido: solo generate + next build (sin tocar la BD remota).
set -euo pipefail

# El puerto 6543 en Supabase es PgBouncer modo transacción: Prisma migrate deploy falla o se cuelga.
is_transaction_pooler_port() {
  case "$1" in *:6543*) return 0 ;; esac
  return 1
}

# Devuelve la primera URL candidata que NO sea :6543.
pick_migrate_url() {
  local val
  for name in DIRECT_URL POSTGRES_URL_NON_POOLING POSTGRES_PRISMA_URL; do
    val="${!name:-}"
    [ -z "$val" ] && continue
    if is_transaction_pooler_port "$val"; then
      echo ">>> omitiendo ${name} (pooler transaccional :6543, no válido para migrate)"
      continue
    fi
    printf '%s' "$val"
    return 0
  done
  val="${DATABASE_URL:-}"
  if [ -n "$val" ] && ! is_transaction_pooler_port "$val"; then
    printf '%s' "$val"
    return 0
  fi
  return 1
}

# Supabase exige TLS; sin ?sslmode=require Prisma puede fallar al conectar desde CI/Vercel.
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
  if MU="$(pick_migrate_url)"; then
    MU="$(ensure_supabase_sslmode "$MU")"
    echo "migrate: URL elegida (longitud ${#MU} caracteres)."
    DATABASE_URL="$MU" npx prisma migrate deploy
  else
    echo "::error::No hay ninguna URL apta para migrar (todas apuntan a pooler :6543 o están vacías)."
    echo "En Vercel → Environment Variables crea DIRECT_URL con una de estas:"
    echo "  • Direct: postgresql://postgres:...@db.TUPROJECT.supabase.co:5432/postgres?sslmode=require"
    echo "  • Session pooler (si direct falla): host aws-REGION.pooler.supabase.com puerto 5432, usuario postgres.PROJECT_REF"
    echo "DATABASE_URL puede seguir siendo la de pooler :6543 solo para la app en runtime."
    exit 1
  fi
fi

echo ">>> prisma generate"
npx prisma generate

echo ">>> next build"
exec npx next build
