#!/usr/bin/env bash
# Marca TODAS las carpetas de prisma/migrations como ya aplicadas SIN ejecutar SQL.
#
# Úsalo SOLO si la base de datos de producción YA tiene el mismo esquema que implican esas migraciones
# (por ejemplo la llenaste con prisma db push o migraste a mano).
# Después de esto, `prisma migrate deploy` en Vercel dejará de fallar con P3005.
#
# Si falta algún cambio (ej. columna isDefault), NO marques esa migración hasta aplicar el SQL o
# marca solo las migraciones anteriores y deja que `migrate deploy` aplique el resto.
#
# Uso (conexión directa/session :5432, NO pooler :6543):
#   export DATABASE_URL="postgresql://..."
#   bash scripts/prisma-baseline-resolve-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: define DATABASE_URL (URI directa o session pooler :5432)." >&2
  exit 1
fi

echo "Marcando migraciones como aplicadas (orden cronológico)..."
shopt -s nullglob
for dir in "$ROOT/prisma/migrations/"*/; do
  name="$(basename "$dir")"
  echo "  -> prisma migrate resolve --applied \"$name\""
  npx prisma migrate resolve --applied "$name"
done

echo "Listo. Próximo deploy en Vercel puede ejecutar prisma migrate deploy sin P3005."
