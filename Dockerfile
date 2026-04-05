FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx patch-package
RUN node scripts/patch-next-app-route-context.js

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder /app/server.js ./
COPY --from=builder /app/scripts ./scripts

USER nextjs

EXPOSE 3000 3001

ENV PORT=3000
ENV WS_PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]