# Image pos IB (langkah 4.3): server API + build web dari origin yang sama.
# Dibangun di perangkat itu sendiri (amd64 atau arm64/Raspberry Pi): `docker compose up -d --build`.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable
WORKDIR /src

FROM base AS build
# Alat kompilasi untuk modul SQLite bila tidak ada versi siap pakai untuk CPU ini.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @ib/web build \
  && pnpm --filter @ib/server deploy --prod --legacy /out/server

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=/data/ib.sqlite \
    BACKUP_DIR=/backups \
    WEB_DIST=/app/web
WORKDIR /app/server
COPY --from=build /out/server /app/server
COPY --from=build /src/apps/web/dist /app/web
RUN mkdir -p /data /backups && chown -R node:node /data /backups
USER node
VOLUME ["/data", "/backups"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "src/index.ts"]
