# Stage 1: Build MES Engine Bundle
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/ packages/
COPY apps/mes-engine/ apps/mes-engine/

RUN npm ci
RUN npm --workspace=@nexushub/client-sdk run build
RUN npm --workspace=@nexushub/mes-engine run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Non-root user
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/client-sdk ./packages/client-sdk
COPY --chown=node:node --from=builder /app/apps/mes-engine/package.json ./apps/mes-engine/
COPY --chown=node:node --from=builder /app/apps/mes-engine/dist ./apps/mes-engine/dist

CMD ["node", "apps/mes-engine/dist/index.js"]

