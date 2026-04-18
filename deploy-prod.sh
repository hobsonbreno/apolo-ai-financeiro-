#!/bin/bash

# Script de Deploy Apolo AI Financeiro - Produção

echo "🚀 Iniciando Deploy em Produção (Servidor01)..."

# 1. Garantir que estamos na branch principal
# git checkout main
git pull origin main

# 2. Criar diretório de dados se não existir
mkdir -p ./data/db

# 3. Subir os containers com as configurações de produção
echo "🏗️ Reconstruindo e subindo os containers..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 4. Limpeza de imagens antigas
echo "🧹 Limpando imagens antigas..."
docker image prune -f

echo "✅ Deploy finalizado com sucesso!"
echo "-------------------------------------------------------"
echo "🌐 Dashboard: http://100.112.184.54:3001"
echo "🔌 API Docs:  http://100.112.184.54:5001/api/docs"
echo "-------------------------------------------------------"
echo "📱 Para ver o QR Code do WhatsApp, rode:"
echo "docker logs -f apolo-whatsapp-prod"
