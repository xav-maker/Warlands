# Une seule image pour les rôles web et worker (guide 1.1) : APP_ROLE choisit le processus.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm -r --filter "./apps/*" build \
 && pnpm --filter @cr/web deploy --prod --legacy /out/web \
 && pnpm --filter @cr/worker deploy --prod --legacy /out/worker \
 && cp -r apps/web/dist apps/web/views apps/web/public /out/web/ \
 && cp -r apps/worker/dist /out/worker/

FROM node:24-slim
# SHA du commit, renvoyé par /health : la CI s'en sert pour vérifier qu'un déploiement a pris.
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=build /out /app
COPY infra/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
