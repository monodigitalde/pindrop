# syntax=docker/dockerfile:1

# ---------- Stage 1: build widget bundle + server ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Native build toolchain for better-sqlite3 (compiled against musl).
RUN apk add --no-cache python3 make g++

# Install dependencies first (better layer caching).
COPY package.json package-lock.json ./
COPY packages/widget/package.json packages/widget/
COPY packages/server/package.json packages/server/
RUN npm ci

# Build both packages.
COPY . .
RUN npm run build

# Drop dev dependencies from the (hoisted) node_modules for a lean runtime.
# The widget's deps are all build-time only (bundled into widget.js), so this
# leaves just the server's runtime deps + the compiled better-sqlite3 binary.
RUN npm prune --omit=dev

# ---------- Stage 2: minimal runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

# Runtime C++ stdlib for the better-sqlite3 native addon.
RUN apk add --no-cache libstdc++
ENV NODE_ENV=production \
    PORT=4878 \
    DB_PATH=/data/db.sqlite \
    ENABLED=true \
    ALLOWED_ORIGINS=*

# Pruned production dependencies (includes the compiled better-sqlite3 binary).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Built server + widget bundle (server resolves ../../widget/dist/widget.js).
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/package.json
COPY --from=builder /app/packages/widget/dist ./packages/widget/dist

# Persisted SQLite database.
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
USER node

EXPOSE 4878

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const bp=(process.env.BASE_PATH||'pindrop').replace(/^\/+|\/+$/g,'');fetch('http://127.0.0.1:'+(process.env.PORT||4878)+'/'+bp+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/server/dist/index.js"]
