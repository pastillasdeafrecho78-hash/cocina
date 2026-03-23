#!/usr/bin/env bash
# ============================================
# Script para detener el entorno de desarrollo
# ServimOS - App Comandas
# NO borra datos: volúmenes Docker y bases se conservan
# ============================================

cd "$(dirname "$0")"

echo "🛑 Deteniendo entorno de desarrollo..."
echo ""

# 1. Lab (PostgreSQL + Redis) - detiene contenedores, los datos en lab_postgres_data se mantienen
LAB_DIR="../Lab"
if [ -d "$LAB_DIR" ] && [ -f "$LAB_DIR/docker-compose.yml" ]; then
    echo "🐘 Deteniendo Lab (PostgreSQL + Redis)..."
    (cd "$LAB_DIR" && sudo docker compose down 2>/dev/null || sudo docker-compose down 2>/dev/null) && echo "   ✅ Lab detenido (datos conservados)" || echo "   ⚠️  Lab no estaba corriendo"
else
    echo "🐘 Lab no encontrado en $LAB_DIR"
fi

echo ""
echo "✅ Listo. Datos en lab_postgres_data intactos."
echo ""
echo "   La app Next.js se detiene con Ctrl+C en su terminal."
echo "   pgAdmin: ciérralo manualmente si lo abriste."
echo ""
