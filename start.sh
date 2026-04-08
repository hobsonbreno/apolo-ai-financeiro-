#!/bin/bash

echo "🚀 Iniciando Finance AI Platform (BYPASS MODE)..."

# Cleanup anterior para evitar conflitos de nomes (Conflict error)
docker-compose --project-name apollo-final down --remove-orphans || true

# Limpar travas do WhatsApp Puppeteer (Causa o erro de Chrome em uso)
echo "🔒 Limpando travas do navegador..."
sudo find ./whatsapp-agent/.wwebjs_auth -name "*SingletonLock*" -delete 2>/dev/null || true
sudo find ./whatsapp-agent/.wwebjs_cache -name "*SingletonLock*" -delete 2>/dev/null || true


# Build and Start com um projeto 100% novo e portas novas
docker-compose --project-name apollo-final up -d --build

echo "✅ Sistema iniciado em novo ecossistema!"
echo "-------------------------------------------------------"
echo "🌐 Dashboard: http://localhost:5175"
echo "🔌 API: http://localhost:3005/api/docs"
echo "-------------------------------------------------------"
echo "📱 Aguarde o QR Code do WhatsApp..."
echo "-------------------------------------------------------"

# Busca o nome real do container do whatsapp no novo projeto
REAL_NAME=$(docker ps --filter "name=apollo-final-whatsapp-agent" --format "{{.Names}}" | head -n 1)

if [ -z "$REAL_NAME" ]; then
    echo "❌ Erro: Container do WhatsApp não encontrado."
    exit 1
fi

docker logs -f "$REAL_NAME"
