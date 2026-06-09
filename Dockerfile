# ============================================
# STAGE 1: Dependencies
# ============================================
FROM node:24.16.0-alpine AS deps

ARG APP_VERSION

ENV APP_VERSION=${APP_VERSION} \
    HUSKY=0

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Production deps only; native modules rebuilt without dev lifecycle hooks
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm rebuild sharp @prisma/engines @apollo/protobufjs tesseract.js && \
    pnpm store prune

# ============================================
# STAGE 2: Builder
# ============================================
FROM node:24.16.0-alpine AS builder

ENV HUSKY=0

RUN apk add --no-cache libc6-compat python3 make g++

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production

RUN pnpm build

# ============================================
# STAGE 3: Production Runner
# ============================================
FROM node:24.16.0-alpine AS runner

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

ENV NODE_ENV=production \
    PORT=5173

USER nestjs

EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').request({hostname:'localhost',port:process.env.PORT||5173,path:'/graphql',method:'POST',headers:{'Content-Type':'application/json'}},(r)=>{process.exit(r.statusCode<500?0:1)}).on('error',()=>process.exit(1)).end(JSON.stringify({query:'{health}'}))" || exit 1

CMD ["node", "dist/src/main.js"]
