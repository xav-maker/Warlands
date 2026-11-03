#!/bin/sh
set -e
# Une commande explicite (par exemple la commande de prédéploiement de Render) passe avant APP_ROLE.
if [ "$#" -gt 0 ]; then exec "$@"; fi
case "${APP_ROLE:-web}" in
  web) cd /app/web && exec node --enable-source-maps dist/main.js ;;
  migrate) cd /app/web && exec node --enable-source-maps dist/migrate.js ;;
  worker) cd /app/worker && exec node --enable-source-maps dist/main.js ;;
  *) echo "APP_ROLE inconnu : $APP_ROLE" >&2; exit 1 ;;
esac
