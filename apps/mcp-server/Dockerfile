# Multi-stage build for production containerization
FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@9

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY adapters/ ./adapters/
COPY apps/ ./apps/
COPY config/ ./config/

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/adapters ./adapters
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/config ./config

EXPOSE 3000
CMD ["node", "apps/mcp-server/dist/index.js"]
