FROM node:22-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
