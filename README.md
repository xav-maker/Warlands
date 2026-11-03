# Les Cinq Régions

Version en ligne du jeu décrit dans [`docs/README-jeu.md`](docs/README-jeu.md), construite selon [`docs/guide-technique.md`](docs/guide-technique.md).

## État

| Jalon                 | État                                                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J0. Socle             | en cours : dépôt, CI, comptes, sessions, squelette de commande faits ; déploiement Render préparé, mise en place à faire ([`infra/deploy/`](infra/deploy/README.md))                                                                                                      |
| J1. Moteur et contenu | en cours : `packages/rng` et `packages/engine` portés, 227 combats de référence verts ; corrections README 16.1 et 16.4 ; moteur v1 (puissances, immunités, soins fixes, passifs de stats, camp de 16 ; 0,96 ms par combat) ; à faire : `packages/gen`, YAML, content-cli |
| J2 à J10              | à venir                                                                                                                                                                                                                                                                   |

## Démarrer en local

Prérequis : Node 24, pnpm 10 (`corepack enable`), Docker Desktop.

```sh
cp .env.example .env
pnpm install
pnpm db:up          # Postgres (port 5433) et Mailpit (http://localhost:8025)
pnpm migrate
pnpm dev            # http://localhost:3000
pnpm dev:worker     # tâches planifiées (pg-boss)
```

Les e-mails de vérification arrivent dans Mailpit.

## Vérifier

```sh
pnpm typecheck && pnpm lint && pnpm format:check && pnpm deps:check
pnpm test           # démarre un Postgres par Testcontainers, ou utilise TEST_DATABASE_URL
```

## Organisation

```
apps/web          serveur HTTP (Fastify, templates Eta, htmx)
apps/worker       tâches pg-boss
packages/shared   codes d'erreur métier et leurs textes
packages/rng      aléa déterministe (xoshiro128**, FNV-1a), copie du prototype
packages/engine   moteur de combat pur ; golden/ : combats de référence
packages/db       schéma Kysely, migrations
packages/domain   commandes métier : squelette transactionnel, identité
packages/testing  base de test réelle pour les tests d'intégration
infra/docker      compose de développement, Dockerfile (rôles web, worker, migrate)
infra/deploy      Blueprint Render et script de déploiement de la préproduction
tools/extract-prototype  charge le prototype et en tire les combats de référence (pnpm golden:v0.4)
docs/             spécifications du jeu
prototype-extrait/ code du prototype (proto-0.4-ville), extrait du bundle publié : référence pour J1
```

## Image

```sh
docker build -f infra/docker/Dockerfile -t cinq-regions .
docker run -e APP_ROLE=migrate --env-file .env cinq-regions
docker run -e APP_ROLE=web -p 3000:3000 --env-file .env cinq-regions
docker run -e APP_ROLE=worker --env-file .env cinq-regions
```
