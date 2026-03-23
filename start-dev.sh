#!/usr/bin/env bash
# ============================================
# Script para iniciar todo el entorno de desarrollo
# ServimOS - App Comandas
#
# ⚠️  NO formatea ni borra bases de datos.
#     Docker reusa el volumen lab_postgres_data.
#     Para detener: ./stop-dev.sh
# ============================================

set -e
cd "$(dirname "$0")"

echo "🚀 Iniciando entorno de desarrollo..."
echo ""

# 1. Docker
echo "📦 Iniciando Docker..."
if systemctl is-active --quiet docker 2>/dev/null; then
    echo "   Docker ya está corriendo"
else
    sudo systemctl start docker 2>/dev/null && echo "   ✅ Docker iniciado" || echo "   ⚠️  Docker no instalado o requiere sudo"
fi

# 2. Lab (PostgreSQL + Redis en Docker con volumen lab_postgres_data)
LAB_DIR="../Lab"
if [ -d "$LAB_DIR" ] && [ -f "$LAB_DIR/docker-compose.yml" ]; then
    echo ""
    echo "🐘 Iniciando Lab (PostgreSQL + Redis)..."
    (cd "$LAB_DIR" && sudo docker compose up -d 2>/dev/null || sudo docker-compose up -d 2>/dev/null) && echo "   ✅ Lab iniciado" || echo "   ⚠️  Revisa que Lab esté en $LAB_DIR"
else
    echo ""
    echo "🐘 PostgreSQL: si usas Lab (Docker), inícialo con: cd ../Lab && sudo docker compose up -d"
fi

# Esperar a que PostgreSQL esté listo
sleep 3

# 3. pgAdmin (en segundo plano)
echo ""
echo "🖥️  Lanzando pgAdmin 4..."
if command -v pgadmin4 &>/dev/null; then
    pgadmin4 &>/dev/null &
    echo "   ✅ pgAdmin lanzado (puede tardar unos segundos)"
elif command -v pgadmin4-web &>/dev/null; then
    pgadmin4-web &>/dev/null &
    echo "   ✅ pgAdmin web lanzado"
elif flatpak list 2>/dev/null | grep -q pgadmin; then
    flatpak run org.pgadmin.pgadmin4 &>/dev/null &
    echo "   ✅ pgAdmin (Flatpak) lanzado"
else
    echo "   ⚠️  pgAdmin: ábrelo desde el menú de aplicaciones"
fi

# 4. App Next.js
echo ""
echo "🌐 Iniciando aplicación Next.js..."
echo "   URL: http://localhost:3000"
echo ""
echo "   (Ctrl+C para detener la app)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
