# Stage 1: Build Client Agent Bundle
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/ packages/
COPY apps/client-agent/ apps/client-agent/

RUN npm ci
RUN npm --workspace=@nexushub/client-sdk run build
RUN npm --workspace=@nexushub/client-agent run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Non-root user
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/client-sdk ./packages/client-sdk
COPY --chown=node:node --from=builder /app/apps/client-agent/package.json ./apps/client-agent/
COPY --chown=node:node --from=builder /app/apps/client-agent/dist ./apps/client-agent/dist

EXPOSE 5050
CMD ["node", "apps/client-agent/dist/index.js"]

