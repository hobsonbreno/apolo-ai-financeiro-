FROM node:20

WORKDIR /app

# Otimização: Copia apenas os pacotes primeiro para usar o cache do Docker
COPY package*.json ./

# Instalação com log detalhado para debug
RUN npm install --loglevel info

# Agora copia o resto do código
COPY . .

# Expõe a porta do NestJS
EXPOSE 3000

# Inicia em modo desenvolvimento
CMD ["npm", "run", "start:dev"]
