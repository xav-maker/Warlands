# Les Cinq Régions

Version en ligne du jeu décrit dans [`docs/README-jeu.md`](docs/README-jeu.md), construite selon [`docs/guide-technique.md`](docs/guide-technique.md).

## État

| Jalon                 | État                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| J0. Socle             | fait : dépôt, CI, comptes, sessions, squelette de commande ; préproduction sur Render (https://cr-preprod-web.onrender.com), déployée automatiquement à chaque push sur `main` ([`infra/deploy/`](infra/deploy/README.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| J1. Moteur et contenu | fait : moteur porté et figé (227 combats de référence), corrections README 16.1, 16.2 et 16.4, moteur v1, `packages/gen` (3 353 vecteurs), contenu en YAML compilé à l'identique, annexe regénérée identique ; reportés : simulation, différence et publication de pack (J4, guide 17.3), 54 capacités actives cibles (J4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| J2. Boucle solo       | fait : position et routes, rencontres (une seule en vue), combat, rediffusion animée imposée (vue 8 bits et vue tableau), butin, sac, banque, soin à l'entrée en ville, marchand, consommables, Codex ; parcours Playwright Havre-Gris → gardien → Port-Salant vert en CI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| J3. Progression       | fait : recettes personnelles matérialisées et matériaux réservés, caserne (recrutement, rachat, escouade, rang, capacités désactivables), atelier et équipement, évolutions aux niveaux 10 et 20, quêtes de ville avec les trophées des rares                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| J4. Contenu cible     | en cours : contenu au format v1 (5 puissances, immunités, soins fixes), 60 capacités nouvelles, monde en graphe (20 régions, 29 routes, 144 monstres, 96 rares), 90 troupes nouvelles et leurs évolutions ; évolutions des 40 troupes du prototype, équipement cible, outils `pnpm content simulate` et `pnpm content diff` ; première passe d'équilibrage faite : escouades de référence équipées, 50 % de victoires aux étapes du palier 1 jusqu'à 10 % au palier 5, gardiens 5 points plus bas, vérifiée par test ; difficulté réglée étape par étape (mult) : routes d'un même palier à 2 points d'écart, première étape facile, difficulté croissante dans la route, escouades de départ pour les premières étapes                                                                                                                                                                                                                                                                                                                                                                          |
| J5. Boutiques         | fait : annonces par ville (piles, exemplaires, troupes) en séquestre, achat avec taxe de 5 %, retrait, expiration à 7 jours par le worker, recherche paginée, historique des prix, notifications ; tests de concurrence et de conservation verts, parcours Playwright entre deux comptes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| J6. Social            | fait : flux SSE (bus Postgres LISTEN/NOTIFY, reprise par resynchronisation plutôt que par Last-Event-ID, présence), chat de région (300 caractères, 1 message par seconde, filtre de mots du pack, conservation 7 jours), messages privés (90 jours), amis, blocage, signalements, sanctions (muet, bannissement de boutique, suspension, bannissement) avec rôles joueur/modérateur/admin, journal d'administration, outils `pnpm grant-role` et `pnpm verify-email` ; adresse e-mail vérifiée exigée pour le chat, les messages, les amis et les boutiques (`REQUIRE_VERIFIED_EMAIL`) ; liens vers un objet, une troupe ou une annonce dans le chat et les messages privés, avec fiche consultable ; renommage forcé d'un pseudo par la modération (le joueur en choisit un nouveau, une fois) ; double authentification TOTP ouverte à tous et exigée de la modération (`REQUIRE_STAFF_2FA`), outil `pnpm reset-2fa` ; parcours Playwright : chat en direct entre deux navigateurs, citation d'une troupe, activation de la 2FA, signalement, mise en sourdine, suspension et renommage forcé |
| J7. Donjons           | en cours : contenu des 12 donjons (48 monstres spéciaux, 36 boss et leurs trophées, 12 matériaux, 24 objets uniques non fabricables, budget × 1,25 et une stat de plus ; leur propriété fixe reste à écrire avec Xavier), paramètres dans `params.yaml`, générateurs des salles (niveau, population, boss toutes les 4 salles, surpuissance au-delà du niveau 30) et du butin de salle, donjons au Codex ; donjon en solo : porte à 2 % à chaque changement d’étape d’une route à donjon, ouverture, salles enchaînées (PV qui persistent, consommables entre deux salles), coffre à part du sac (or versé à la sortie), sortie vers la banque et l’étape d’origine, défaite (coffre perdu, retour en ville soigné), action sur une page périmée refusée ; combats de salle enregistrés et rejouables                                                                                                                                                                                                                                                                                            |
| J8 à J10              | à venir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

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

Les e-mails de vérification arrivent dans Mailpit. Pour tester la suite du jeu sans tout gagner à la main : `pnpm seed-dev squad <e-mail>` donne à ce compte une escouade de niveau 30 (bases locales seulement).

## Vérifier

```sh
pnpm typecheck && pnpm lint && pnpm format:check && pnpm deps:check
pnpm content validate   # contenu YAML
pnpm test               # démarre un Postgres par Testcontainers, ou utilise TEST_DATABASE_URL
pnpm build && pnpm e2e  # parcours Playwright (pnpm exec playwright install chromium la première fois)
```

## Organisation

```
apps/web            serveur HTTP (Fastify, templates Eta, htmx) : pages et commandes de jeu
apps/worker         tâches pg-boss
packages/shared     codes d'erreur métier et leurs textes
packages/rng        aléa déterministe (xoshiro128**, FNV-1a), copie du prototype
packages/engine     moteur de combat pur ; golden/ : combats de référence
packages/content    schémas du contenu YAML, chargement, compilation en pack, validation
packages/gen        générateurs déterministes : rencontres, butin, exemplaires, recettes, quêtes, entrée du moteur
packages/ui-combat  rediffusion des combats dans le navigateur (vue 8 bits, vue tableau et journal)
packages/db         schéma Kysely, migrations
packages/domain     commandes métier : identité, expédition, combat, inventaire, or, services de ville
packages/testing    base de test réelle pour les tests d'intégration
infra/docker        compose de développement, Dockerfile (rôles web, worker, migrate)
infra/deploy        Blueprint Render et script de déploiement de la préproduction
tools/content-cli   valider, compiler le contenu, regénérer l'annexe (pnpm content validate|compile|annexe)
tools/extract-prototype  charge le prototype et en tire les références (pnpm golden:v0.4, pnpm golden:gen)
tools/seed-dev      données de test (pnpm seed-dev squad <e-mail>), bases locales seulement
e2e/                parcours Playwright
docs/               spécifications du jeu
content/            contenu du jeu en YAML : la source (guide 5.1)
prototype-extrait/  code du prototype (proto-0.4-ville), extrait du bundle publié : référence des règles
```

## Image

```sh
docker build -f infra/docker/Dockerfile -t cinq-regions .
docker run -e APP_ROLE=migrate --env-file .env cinq-regions
docker run -e APP_ROLE=web -p 3000:3000 --env-file .env cinq-regions
docker run -e APP_ROLE=worker --env-file .env cinq-regions
```
