# Build stage — run from voiceroom/ (monorepo root)
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @voiceroom/shared build
RUN cd apps/server && npx prisma generate
RUN pnpm --filter @voiceroom/server build

# Run stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./node_modules/@voiceroom/shared
EXPOSE 4000
# Migrations: run manually or via entrypoint script
CMD ["node", "dist/index.js"]
