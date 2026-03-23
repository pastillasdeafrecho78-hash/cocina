#!/usr/bin/env bash
# ============================================
# Restaura la base desde un backup
# Uso: ./restore-backup.sh [archivo.sql]
#      Si no pasas archivo, usa el más reciente en backups/
# ============================================

cd "$(dirname "$0")"
BACKUP_DIR="./backups"

if [ -n "$1" ]; then
    BACKUP_FILE="$1"
else
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/servimos_*.sql 2>/dev/null | head -1)
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ No hay backup. Usa: ./restore-backup.sh backups/servimos_YYYYMMDD_HHMMSS.sql"
    exit 1
fi

echo "🔄 Restaurando desde: $BACKUP_FILE"
echo "   (Lab debe estar corriendo: ./start-dev.sh en otra terminal, luego Ctrl+C y ejecuta esto)"
echo ""

if PGPASSWORD=postgres sudo docker exec -i laboratorio-postgres psql -U postgres -d ServimOS < "$BACKUP_FILE" 2>/dev/null; then
    echo "✅ Restauración completada"
else
    echo "❌ Error. ¿Lab está corriendo? Ejecuta: cd ../Lab && sudo docker compose up -d"
    exit 1
fi
