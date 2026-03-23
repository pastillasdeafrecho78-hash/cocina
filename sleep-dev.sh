#!/usr/bin/env bash
# ============================================
# Apaga todo el entorno de desarrollo
# ANTES: hace backup de la BD para que NUNCA se pierda nada
# Los datos persisten en: volumen Docker + archivo backup
# ============================================

cd "$(dirname "$0")"
LAB_DIR="../Lab"
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/servimos_$(date +%Y%m%d_%H%M%S).sql"

echo "💤 Apagando todo el entorno..."
echo ""

# 0. BACKUP de la base (por si acaso - los datos ya están en el volumen)
mkdir -p "$BACKUP_DIR"
if [ -d "$LAB_DIR" ]; then
    echo "💾 Respaldo de la base de datos..."
    if PGPASSWORD=postgres sudo docker exec laboratorio-postgres pg_dump -U postgres -d ServimOS > "$BACKUP_FILE" 2>/dev/null; then
        echo "   ✅ Backup guardado: $BACKUP_FILE"
    else
        echo "   ⚠️  Lab no corriendo, no hay backup (datos en volumen)"
    fi
fi
echo ""

# 1. Lab (contenedores) - NUNCA usamos -v, el volumen se conserva
if [ -d "$LAB_DIR" ] && [ -f "$LAB_DIR/docker-compose.yml" ]; then
    echo "🐘 Deteniendo Lab..."
    (cd "$LAB_DIR" && sudo docker compose down 2>/dev/null || sudo docker-compose down 2>/dev/null) && echo "   ✅ Lab detenido" || true
fi

# 2. Docker daemon
echo ""
echo "📦 Deteniendo Docker..."
if systemctl is-active --quiet docker 2>/dev/null; then
    sudo systemctl stop docker 2>/dev/null && echo "   ✅ Docker detenido" || echo "   ⚠️  No se pudo detener"
else
    echo "   Docker ya estaba detenido"
fi

# 3. PostgreSQL nativo
echo ""
echo "🐘 Deteniendo PostgreSQL (sistema)..."
if systemctl is-active --quiet postgresql 2>/dev/null; then
    sudo systemctl stop postgresql 2>/dev/null && echo "   ✅ PostgreSQL detenido" || true
else
    echo "   PostgreSQL no estaba corriendo"
fi

echo ""
echo "✅ Todo apagado."
echo "   Datos: en volumen Docker + backup en backups/"
echo "   Para volver: ./start-dev.sh"
echo ""
