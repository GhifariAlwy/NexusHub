# Stage 1: Build Backend Bundle
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/ packages/
COPY apps/portal-backend/ apps/portal-backend/

RUN npm ci
RUN npm --workspace=@nexushub/client-sdk run build
RUN npm --workspace=@nexushub/portal-backend run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Non-root user
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/client-sdk ./packages/client-sdk
COPY --chown=node:node --from=builder /app/apps/portal-backend/package.json ./apps/portal-backend/
COPY --chown=node:node --from=builder /app/apps/portal-backend/dist ./apps/portal-backend/dist

EXPOSE 4000
CMD ["node", "apps/portal-backend/dist/index.js"]

