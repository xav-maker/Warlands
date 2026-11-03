# Une seule image pour les rôles web et worker (guide 1.1) : APP_ROLE choisit le processus.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
# Tous les package.json de l'espace de travail : pnpm doit voir chaque paquet pour l'installer et le lier.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/rng/package.json packages/rng/
COPY packages/engine/package.json packages/engine/
COPY packages/gen/package.json packages/gen/
COPY packages/content/package.json packages/content/
COPY packages/testing/package.json packages/testing/
COPY tools/content-cli/package.json tools/content-cli/
COPY tools/extract-prototype/package.json tools/extract-prototype/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm -r --filter "./apps/*" build \
 && pnpm --filter @cr/web deploy --prod --legacy /out/web \
 && pnpm --filter @cr/worker deploy --prod --legacy /out/worker \
 && cp -r apps/web/dist apps/web/views apps/web/public content /out/web/ \
 && cp -r apps/worker/dist /out/worker/

FROM node:24-slim
# SHA du commit, renvoyé par /health : la CI s'en sert pour vérifier qu'un déploiement a pris.
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=build /out /app
COPY infra/docker/entrypoint.sh /entrypoint.sh
# npm, corepack et yarn ne servent pas à l'exécution : on les retire (moins de surface, moins d'alertes Trivy).
RUN chmod +x /entrypoint.sh \
 && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn* /opt/yarn*
USER node
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
