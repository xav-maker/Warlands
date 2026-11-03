#!/usr/bin/env bash
# Déploie l'image d'un commit sur Render, puis vérifie la préproduction (guide 17.2, étape 8).
# Variables : IMAGE, SHA, HOOK_WEB, HOOK_WORKER (crochets de déploiement Render), PREPROD_URL.
set -euo pipefail

: "${IMAGE:?}" "${SHA:?}" "${HOOK_WEB:?}" "${HOOK_WORKER:?}" "${PREPROD_URL:?}"
IMG="${IMAGE,,}:${SHA}"
BASE="${PREPROD_URL%/}"

deploy() {
  local sep='?'; [[ "$1" == *\?* ]] && sep='&'
  curl -fsS -X POST "$1${sep}imgURL=$(jq -rn --arg v "$IMG" '$v|@uri')" -o /dev/null
}

# Le web d'abord : sa commande de prédéploiement passe les migrations avant que le worker ne démarre.
echo "Déploiement de $IMG (web)"
deploy "$HOOK_WEB"

echo "Attente de la version $SHA sur $BASE/health"
for i in $(seq 1 60); do
  v=$(curl -fsS "$BASE/health" 2>/dev/null | jq -r '.version // empty' || true)
  [ "$v" = "$SHA" ] && break
  [ "$i" = 60 ] && { echo "La préproduction sert encore « ${v:-rien} » après 15 minutes." >&2; exit 1; }
  sleep 15
done

echo "Déploiement de $IMG (worker)"
deploy "$HOOK_WORKER"

echo "Tests de fumée"
for path in / /inscription /connexion; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  [ "$code" = 200 ] || { echo "$path répond $code" >&2; exit 1; }
  echo "ok $path"
done
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/ville")
[ "$code" = 302 ] || { echo "/ville sans session répond $code, 302 attendu" >&2; exit 1; }
echo "ok /ville (redirection sans session)"
