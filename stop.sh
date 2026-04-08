#!/bin/bash

echo "🛑 Iniciando encerramento total do Finance AI (Apollo)..."

# 1. Comando principal do Docker
docker-compose --project-name apollo-final down --remove-orphans 2>/dev/null || true

# 2. Força bruta (Limpeza de resíduos em portas críticas)
echo "🧹 Limpando resíduos de rede..."
# Para preventivamente qualquer container que ainda esteja segurando as portas do Dash ou API
REDU_IDS=$(docker ps -a -q --filter "publish=5175" --filter "publish=3005")
if [ ! -z "$REDU_IDS" ]; then
    docker stop $REDU_IDS 2>/dev/null || true
    docker rm $REDU_IDS 2>/dev/null || true
fi

echo "✅ Todos os serviços e portas foram liberados! Bom descanso."
