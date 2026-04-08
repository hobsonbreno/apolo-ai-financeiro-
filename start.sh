#!/bin/bash

echo "🚀 Iniciando Finance AI Platform (Apolo v1.0)..."

# 1. Limpeza preventiva de sessões antigas
./stop.sh >/dev/null 2>&1 || true

# 2. Destravar o WhatsApp (SingletonLock do Puppeteer)
echo "🔒 Limpando travas do navegador (Puppeteer)..."
sudo find ./whatsapp-agent/.wwebjs_auth -name "*SingletonLock*" -delete 2>/dev/null || true
sudo find ./whatsapp-agent/.wwebjs_cache -name "*SingletonLock*" -delete 2>/dev/null || true

# 3. Subir com compilação atualizada
echo "🏗️ Construindo e subindo os containers..."
docker-compose --project-name apollo-final up -d --build

echo "✅ Sistema iniciado com sucesso!"
echo "-------------------------------------------------------"
echo "🌐 Dashboard (Front): http://localhost:5175"
echo "🔌 API (Backend): http://localhost:3005/api/docs"
echo "-------------------------------------------------------"
echo "📱 Aguarde o QR Code do WhatsApp nos logs abaixo..."
echo "-------------------------------------------------------"

# 4. Exibir o QR Code automaticamente
REAL_NAME=$(docker ps --filter "name=apollo-final-whatsapp-agent" --format "{{.Names}}" | head -n 1)
if [ ! -z "$REAL_NAME" ]; then
    docker logs -f "$REAL_NAME"
else
    echo "⚠️ Agente de WhatsApp ainda está subindo, verifique o status com 'docker ps'."
fi
