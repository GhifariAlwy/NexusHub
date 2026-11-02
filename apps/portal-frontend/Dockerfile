# Stage 1: Build Frontend Assets
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/ packages/
COPY apps/portal-frontend/ apps/portal-frontend/

RUN npm ci
RUN npm --workspace=@nexushub/portal-frontend run build

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/portal-frontend/dist /usr/share/nginx/html
COPY apps/portal-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

