FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Adicionado --legacy-peer-deps para resolver conflito React 19 vs Lucide
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
