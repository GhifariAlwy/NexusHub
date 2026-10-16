#!/bin/bash

# ====================================================================
# NexusHub Lite: Start All Services Script
# ====================================================================

echo "======================================================="
echo "🚀 MENJALANKAN NEXUSHUB LITE (DATA EXCHANGE PLATFORM)"
echo "======================================================="

# 1. Pastikan Docker Containers Berjalan
echo "1. Memeriksa container Docker..."
docker compose up -d

# 2. Build Client SDK jika belum
if [ ! -d "packages/client-sdk/dist" ]; then
  echo "2. Melakukan build SDK..."
  npm --workspace=@nexushub/client-sdk run build
fi

echo "======================================================="
echo "3. Menyalakan seluruh service (Backend, Frontend, MES, Agent)..."
echo "👉 Portal Frontend: http://localhost:5173"
echo "👉 Grafana:         http://localhost:3000 (admin / admin)"
echo "👉 Kafka UI:        http://localhost:8080"
echo "👉 Backend API:     http://localhost:4000"
echo "Tekan CTRL+C untuk menghentikan seluruh service."
echo "======================================================="

npm run dev

