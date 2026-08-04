# Node.js LTS em base slim (Debian)
FROM node:20-slim

# O Tabula é uma lib Java, entao o container precisa de um JRE.
# openjdk-17-jre-headless é suficiente para rodar o jar (sem interface grafica).
RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-17-jre-headless && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia primeiro os manifests para aproveitar o cache de camadas do Docker
COPY package*.json ./
RUN npm install --omit=dev

# Copia o restante do projeto (app.js, public/, o jar do Tabula, etc.)
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "app.js"]
