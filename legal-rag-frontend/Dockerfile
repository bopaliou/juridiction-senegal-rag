FROM node:18-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
RUN npm ci

# Copier le code source
COPY . .

# Build l'application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage de production
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copier les fichiers nécessaires
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]

