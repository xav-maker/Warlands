#!/bin/sh
set -e
# Rôle : premier argument (web, worker, migrate), sinon APP_ROLE, sinon web.
# Render lance la commande de prédéploiement sans interpréter les guillemets : elle doit être
# « /entrypoint.sh migrate », sans sh -c ni variable en préfixe.
# Toute autre commande passée en argument est exécutée telle quelle.
case "${1:-}" in
  web | worker | migrate) APP_ROLE="$1" ;;
  "") ;;
  *) exec "$@" ;;
esac
case "${APP_ROLE:-web}" in
  web) cd /app/web && exec node --enable-source-maps dist/main.js ;;
  migrate) cd /app/web && exec node --enable-source-maps dist/migrate.js ;;
  worker) cd /app/worker && exec node --enable-source-maps dist/main.js ;;
  *) echo "APP_ROLE inconnu : $APP_ROLE" >&2; exit 1 ;;
esac
