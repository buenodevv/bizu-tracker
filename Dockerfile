# syntax=docker/dockerfile:1

# =============================================================================
# Bizu Tracker — imagem de produção
#
# Build multi-stage:
#   1. deps    — instala dependências (usa cache do lockfile)
#   2. builder — compila o Next.js em modo standalone
#   3. runner  — imagem final mínima, roda como usuário sem privilégios
# =============================================================================

ARG NODE_VERSION=22-alpine

# -----------------------------------------------------------------------------
# 1. Dependências
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# `libc6-compat` ajuda módulos nativos (pdf-parse/@napi-rs) no Alpine.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci


# -----------------------------------------------------------------------------
# 2. Build
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis NEXT_PUBLIC_* são embutidas no bundle DURANTE o build.
# Precisa ser build arg; trocar depois exige reconstruir a imagem.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Desativa a telemetria do Next durante o build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# -----------------------------------------------------------------------------
# 3. Runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Executa como usuário sem privilégios.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Estático público e artefatos do standalone.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# O modo standalone copia apenas os arquivos que o tracer do Next identificou,
# o que deixa de fora os `pdf.worker.mjs` e o binário nativo do canvas — ambos
# resolvidos em runtime. Copiamos os pacotes completos para garantir a extração
# de PDF em produção. O binário do @napi-rs/canvas é instalado já na versão
# correta para o Linux do builder durante o `npm ci`.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdf-parse ./node_modules/pdf-parse
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@napi-rs ./node_modules/@napi-rs

USER nextjs

EXPOSE 3000

# Healthcheck: usa a rota dedicada /api/health, que não passa por autenticação
# e não depende do Supabase. Um redirect (ex.: /login) contaria como falha.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
