# Guide technique : réaliser le jeu en ligne jusqu'à un produit déployable

Version 1.0, 3 novembre 2026.

**Ce que ce document décrit.** Comment construire, tester, héberger et exploiter la version en ligne du jeu décrite dans le [README](/mnt/project-files/multijoueur/README-jeu.md) (partie I : jeu actuel, partie II : jeu cible), avec le contenu de [contenu-cible-monde.md](/mnt/project-files/multijoueur/contenu-cible-monde.md) et [contenu-cible-unites.md](/mnt/project-files/multijoueur/contenu-cible-unites.md). Il va du premier commit jusqu'à la mise en production et à l'exploitation courante.

**Ce qu'il ne refait pas.** Il part de l'[architecture technique v1.1](/mnt/project-files/architecture/architecture-technique.md), validée par Xavier (décisions A1 à A10, questions Q-A1 à Q-A4). Ces décisions ne sont pas rouvertes ici. Elles sont seulement adaptées au jeu cible (régions en graphe, boutiques par ville, donjons en duo, chat) et complétées sur ce que l'architecture laissait aux fils Échanges et Infra.

**Qui le lit.** Un développeur, ou une IA de code, qui construit le jeu. Chaque section donne quoi construire, comment, et à quoi on reconnaît que c'est fini.

Notations : **[A]** = repris de l'architecture validée ; **[H]** = choix proposé ici, à valider ou à changer ; **[Xavier]** = décision de Xavier.

---

## Sommaire

1. Vue d'ensemble
2. Stack technique
3. Organisation du dépôt
4. Porter le prototype
5. Contenu de jeu : format, validation, publication
6. Modèle de données
7. Commandes et pages
8. Expédition, rencontres et rediffusion côté serveur
9. Donjons et duo
10. Temps réel : notifications, chat, présence
11. Boutiques des joueurs
12. Social et modération
13. Sécurité et anti-triche
14. Données personnelles et obligations légales
15. Performance et capacité
16. Stratégie de tests
17. Environnements, intégration et déploiement continus
18. Hébergement
19. Observabilité et exploitation
20. Feuille de route par jalons
21. Check-list de mise en production
22. Points à trancher

---

## 1. Vue d'ensemble

### 1.1 Les pièces

```
 Navigateur (pages HTML + htmx, îlot JS de rediffusion, connexion SSE)
        │ HTTPS
        ▼
 Répartiteur / proxy TLS (fourni par l'hébergeur)
        │
        ├──► web (Node.js, N exemplaires sans état)
        │      pages, commandes, flux SSE, administration
        │
        └──► worker (Node.js, 1 à 2 exemplaires)
               expirations, minuteries de donjon, invariants, e-mails, purges

 web et worker ──► PostgreSQL managé (unique source de vérité, PITR)
                   + LISTEN/NOTIFY pour la diffusion entre exemplaires
 web ──► service d'e-mail transactionnel (vérification, mot de passe oublié)
 tous ──► journaux, métriques, traces, erreurs (outil d'observabilité)
 sauvegardes logiques ──► stockage objet chiffré, autre fournisseur ou autre région
 fichiers statiques (CSS, JS, sprites) ──► servis par web avec cache long, CDN optionnel
```

Un seul code, une seule image de conteneur, deux rôles (`web` et `worker`) choisis par une variable d'environnement [A, A1].

### 1.2 Principes qui guident chaque choix

1. **L'économie ne doit jamais perdre ni dupliquer un bien** : un bien n'est qu'à un seul endroit, il ne bouge que par le service de transfert, et l'or passe par un grand livre [A6, A7].
2. **Le serveur décide de tout** : le client n'envoie que des intentions. L'aléa, les stats, les résultats et les prix sont calculés côté serveur [A10].
3. **Une commande correspond à une transaction**, avec un verrou sur le joueur et une clé d'idempotence [A9].
4. **Le combat est une fonction pure et déterministe**, rejouable à partir de son entrée, de sa graine et de la version du moteur [A5].
5. **Le contenu est séparé du code** : un pack versionné et immuable, publié sans redéployer [A8].
6. **Rester simple à exploiter** : un monolithe, une base, pas de Redis ni de Kubernetes tant qu'aucune mesure ne l'exige.

### 1.3 Ce qui change par rapport à l'architecture v1.1

| Sujet | Architecture v1.1 | Jeu cible (README partie II) | Conséquence technique |
|---|---|---|---|
| Factions | 3 factions et une ville neutre | Aucune faction, départ unique [Xavier] | La colonne faction, les marchés de faction et les contrôles de troupes exclusives disparaissent. Le service de transfert garde un point d'extension « règle de transfert » pour pouvoir les réintroduire. |
| Marché | 4 carnets d'ordres | **Une boutique par ville** (20), annonces à prix fixe | Les ordres d'achat et la confrontation de carnets ne sont pas nécessaires. On a une table d'annonces indexée par ville (section 11). |
| Escouade | 5 emplacements, 5 de population, réserve emmenée | **8 emplacements, 11 de population**, caserne illimitée, engagement en ville seulement | Le conteneur `RESERVE` n'est pas créé. La caserne devient le conteneur `BARRACKS`. La réserve (Q-A4) est abandonnée [Xavier, 3 novembre 2026]. |
| Soins | Gratuits en ville [H] | Soin automatique à toute entrée en ville [Xavier] | Le soin est un effet de la commande d'arrivée en ville, pas une commande séparée. |
| Combat | 1 joueur contre des monstres | Duo possible : 2 joueurs, 16 emplacements, 22 de population | L'entrée du moteur accepte un camp composé de deux propriétaires. Le résultat est réparti par propriétaire (section 9). |
| Temps réel | SSE pour les notifications d'échange | Chat par région, messages privés, invitations de donjon | Le même canal SSE porte tout. La diffusion entre exemplaires passe par LISTEN/NOTIFY (section 10). |
| Monde | 15 maps, déblocages | 20 régions, 29 routes de 5 étapes, chaque traversée se refait | La position devient « ville », « route + sens + étape » ou « donjon + salle ». Pas de table de déblocages de chemins. |

---

## 2. Stack technique

Les choix de l'architecture sont repris [A] et précisés. On prend la version majeure stable au moment du démarrage, puis on la fige dans le fichier de verrouillage et l'image de conteneur.

| Couche | Choix | Remarque |
|---|---|---|
| Langage | TypeScript en mode strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | Le moteur du prototype est déjà en TypeScript. |
| Exécution | Node.js, version LTS active | Une seule version partout : poste, CI, image. |
| Serveur HTTP | Fastify | Validation des schémas intégrée, rapide, extensible. |
| Rendu | Templates côté serveur (JSX côté serveur ou Eta) + **htmx 2** | Pages complètes et fragments `hx-*` produits par les mêmes templates. |
| Îlots JS | TypeScript compilé par esbuild : rediffusion du combat (reprise de `replay.ts` et `pixel.ts`), panneau de chat | Pas de framework SPA. Le choix des capacités désactivées est un simple formulaire htmx. |
| CSS | CSS natif, variables, un thème par région | Repris du prototype. |
| Base | PostgreSQL, version majeure récente supportée par l'hébergeur | Extensions : `pg_trgm` pour la recherche en boutique, `pg_stat_statements` pour les requêtes lentes. |
| Accès aux données | Kysely | SQL explicite, typé, contrôle direct de `FOR UPDATE`. |
| Migrations | Migrations SQL versionnées (outil de Kysely ou dbmate) | Toujours compatibles avec la version précédente du code (17.4). |
| Validation | Zod | Commandes HTTP, contenu de jeu (dont les stratégies par défaut), variables d'environnement. |
| File de tâches | pg-boss (sur Postgres) | Expirations, minuteries, e-mails, purges, invariants. |
| Temps réel | Server-Sent Events + LISTEN/NOTIFY | Pas de WebSocket en V1 (section 10). |
| Authentification | Better Auth, ou une implémentation maison simple : argon2id, sessions en base, cookie `httpOnly` | La librairie apporte la vérification d'e-mail, la réinitialisation et la 2FA pour l'administration. |
| E-mail | Fournisseur transactionnel européen (Brevo, Scaleway TEM, Postmark…) [H] | DKIM, SPF et DMARC configurés sur le domaine. |
| Tests | Vitest, fast-check, Testcontainers (Postgres réel), Playwright, k6 | Section 16. |
| Observabilité | Logs JSON (pino), OpenTelemetry (traces et métriques), Sentry ou GlitchTip pour les erreurs | Section 19. |
| Monorepo | pnpm workspaces | Turborepo seulement si les temps de build l'exigent. |
| Qualité | ESLint, Prettier, `tsc --noEmit`, dependency-cruiser pour les règles de dépendance entre paquets | En CI à chaque push. |
| Conteneur | Image Docker multi-étapes, utilisateur non root, base distroless ou `node:<lts>-slim` | Même image pour `web` et `worker`. |

Ce qu'on n'utilise pas en V1, et pourquoi : pas de microservices (ils casseraient l'atomicité des transferts), pas de GraphQL (les pages sont rendues par le serveur), pas de Redis (Postgres couvre les sessions, les files et la diffusion à cette échelle), pas de Kubernetes (une plateforme gérée suffit, section 18).

---

## 3. Organisation du dépôt

### 3.1 Arborescence

```
apps/
  web/                    serveur HTTP
    src/routes/           une route par page ou commande, regroupées par module
    src/views/            templates (pages, fragments htmx, mises en page, thèmes)
    src/sse/              flux d'événements, abonnements, diffusion
    src/admin/            back-office (routes séparées, rôle admin, 2FA)
    src/plugins/          session, CSRF, limitation de débit, en-têtes, journaux
  worker/                 tâches pg-boss et tâches planifiées
packages/
  engine/                 moteur de combat pur (aucune dépendance runtime, aucun I/O)
  content/                schémas Zod du contenu, chargeur, compilateur de pack, validateur
  gen/                    générateurs déterministes : rencontres, butin, exemplaires, recettes, quêtes, donjons
  domain/                 modules métier (3.2), service de transfert, grand livre
  db/                     schéma Kysely, migrations, requêtes partagées
  rng/                    PRNG xoshiro128**, FNV-1a, dérivation de graines, tirage cryptographique
  ui-combat/              rediffusion HTML et 8 bits, côté navigateur (types du journal seulement)
  shared/                 types partagés (identifiants, erreurs métier, codes de messages)
content/                  données du jeu en YAML (section 5)
tools/
  content-cli/            valider, compiler, simuler, comparer, publier un pack
  extract-prototype/      script ponctuel : extrait le contenu du prototype en YAML (section 4.3)
  balance/                rapports d'équilibrage (simulations de masse)
  seed-dev/               jeux de données de développement (joueurs, objets, annonces)
infra/
  docker/                 Dockerfile, docker-compose de développement
  deploy/                 configuration de l'hébergeur (fichiers déclaratifs)
  runbooks/               procédures d'exploitation (section 19.5)
.github/workflows/        intégration et déploiement continus (section 17)
```

### 3.2 Modules métier (`packages/domain`)

| Module | Responsabilité | Tables principales |
|---|---|---|
| Identité | comptes, pseudo, sessions, rôles, suppression de compte | `account`, `session`, `player` |
| Monde | position, déplacements, entrée en ville et soin automatique | `player` (position), `expedition` |
| Rencontres | groupe en vue sur une étape, rares, porte de donjon | `encounter` |
| Effectif | troupes, unités, formes, niveaux, XP, escouade, caserne, capacités désactivées, rachat d'unités, prêt de la garde | `troop`, `troop_unit` |
| Évolution | recettes d'évolution, choix de branche | `troop`, `player_recipe` |
| Inventaire | piles et exemplaires, sac, banque, équipement | `item_stack`, `item_instance` |
| Transfert | **le seul** module qui déplace un bien ; journal des mouvements | `asset_move` |
| Or | grand livre en partie double | `gold_account`, `gold_entry` |
| Atelier et recrutement | recettes personnelles, fabrication, recrutement, matériaux réservés à l'échange | `player_recipe` |
| Marchand | achat et rachat à prix fixe auprès du PNJ | aucune (mouvements et grand livre) |
| Combat | préparation de l'entrée, appel du moteur, application du résultat, rediffusion, blocage de rediffusion | `battle`, `battle_participant` |
| Butin | tirages, sac plein, butin en attente | `item_stack` (conteneur `PENDING_LOOT`) |
| Quêtes | génération par ville, suivi, rendu | `quest` |
| Donjon | porte, groupe, salles, coffre, votes, minuteries | `dungeon_run`, `dungeon_member` |
| Boutique | annonces, achat, retrait, expiration, historique des prix | `shop_listing`, `shop_sale` |
| Social | amis, blocages, messages privés, chat de région | `friendship`, `block`, `direct_message`, `chat_message` |
| Modération | signalements, mises en sourdine, bannissements | `report`, `sanction` |
| Notifications | notifications persistantes et diffusion temps réel | `notification` |
| Contenu | pack actif en mémoire, accès en lecture | `content_pack` |
| Administration et audit | consultation, corrections tracées | `admin_action` |

Règles [A] :
- un module n'écrit jamais dans les tables d'un autre, il appelle son service ;
- tous les appels d'une même commande partagent la même transaction, passée explicitement en paramètre (`tx`) ;
- dependency-cruiser fait respecter en CI que `engine`, `rng` et `content` ne dépendent de rien d'autre du dépôt, et que seul `domain/transfer` écrit dans les colonnes de conteneur.

### 3.3 Forme d'une commande

Toutes les commandes suivent le même squelette, écrit une fois dans `domain/command.ts` :

```ts
export const vendreEnBoutique = command({
  name: 'shop.list',
  input: z.object({ asset: AssetRef, quantity: z.number().int().positive(), price: z.number().int().positive() }),
  rate: { perMinute: 20 },
  where: ['city'],                       // position exigée
  async run(ctx, input) {               // ctx = { tx, player (verrouillé), content, rng, now, emit }
    // 1. règles métier (erreurs typées → message affiché au joueur)
    // 2. transferts et grand livre
    // 3. ctx.emit(...) : événements diffusés après le commit
    return { listingId };
  },
});
```

Le cadre exécute dans l'ordre : session → schéma → limitation de débit → idempotence → `BEGIN` → `SELECT … FROM player WHERE id = $1 FOR UPDATE` → contrôle de position → `run` → enregistrement de la réponse d'idempotence → `COMMIT` → diffusion des événements → rendu. Si une étape échoue, on fait `ROLLBACK` et aucun événement n'est diffusé [A, 3.2 et 8].

Les erreurs métier sont des codes stables (`SHOP_NOT_IN_CITY`, `BAG_FULL`, `TROOP_ENGAGED`…), traduits en français dans les templates. Les messages du prototype (`jeu.ts`) servent de base aux textes.

---

## 4. Porter le prototype

Le prototype est la **source de vérité des règles** (README, partie I). Il ne faut pas le réécrire de mémoire : on reprend son code là où il est pur, et on le fige par des tests avant de le modifier.

### 4.1 Ce qui est repris tel quel

| Fichier du prototype | Destination | Travail |
|---|---|---|
| `engine.ts` (moteur `proto-0.4-ville`) | `packages/engine` | Copie, puis nettoyage des types. Aucun changement de comportement avant d'avoir posé les tests de référence (4.2). |
| PRNG xoshiro128**, `hash` FNV-1a (`gen.ts`) | `packages/rng` | Copie à l'identique. Tests de vecteurs connus. |
| `ia.ts` (stratégies par défaut), règles si / alors | `packages/engine` (exécution) et `tools/content-cli` (génération des stratégies par défaut) | Le vocabulaire devient un schéma Zod versionné. `strategie.ts` (éditeur) n'est pas repris : le joueur ne paramètre plus les stratégies [Xavier, README 20.1]. |
| `gen.ts` (rencontres, butin, exemplaires), `quetes.ts`, recettes | `packages/gen` | Fonctions pures qui prennent `(contenu, graine, paramètres)`. Elles ne lisent plus l'état `Game`. |
| `replay.ts`, `pixel.ts` | `packages/ui-combat` | Lecture du journal, inchangée. |
| `codex.ts` | Pages du Codex rendues par le serveur à partir du pack | Réécriture en templates. |
| `jeu.ts` (commandes) | `packages/domain` | **Réécrit** : chaque fonction devient une commande transactionnelle. Les conditions et les messages d'erreur sont repris un par un (une case du tableau de suivi par commande). |
| `content.ts`, `unites.ts`, `bestiaire.ts`, `monde.ts`, `sorts.ts` | `content/*.yaml` | Extraits par script (4.3). |
| `app.ts`, `dom.ts`, `page.html` | Templates serveur | Réécrits : l'interface devient une suite de pages. |

### 4.2 Figer le comportement du moteur avant de le modifier

1. Avec le moteur copié, générer **200 combats de référence** à partir du prototype : escouades et groupes variés de chaque région, gardiens, rares, chaque capacité utilisée au moins une fois. Stocker `entrée + graine → journal attendu` dans `packages/engine/golden/v0.4/`.
2. La CI rejoue ces combats à chaque modification. Le moindre écart fait échouer la CI, sauf si la version du moteur change.
3. Corriger alors les **bizarreries** de la section 16 du README, une par une, en connaissance de cause. Chacune donne une version du moteur et des combats de référence régénérés et relus. Recommandation [H] : corriger les points 1 (Embrasement), 2 (ajustement du gardien), 4 (`allyHpBelow`) et 6 (`searchFight`) ; trancher le point 3 (XP) avec le point ouvert 1 du README.
4. Implémenter ensuite le **moteur v1** du jeu cible (README 19) : 5 puissances, coefficients par capacité, types de dégâts déclarés séparément, immunités des monstres (dégâts à 0, effet lié bloqué, ciblage qui évite les immunisés, conditions `targetImmune` et `targetNotImmune`), soins et boucliers en valeurs fixes, camp de 16 emplacements pour le duo, passifs de stats (contenu-cible-unites.md 3.6). Avec des coefficients de 1 000 et la puissance égale à l'ancienne attaque, la v1 doit reproduire les combats v0.4 corrigés à l'identique, sauf pour les soins : c'est le test de non-régression de la migration (README 19.3).
5. Nouvelle série de combats de référence `golden/v1/` pour le contenu cible.

**Fini quand** : la v1 passe ses combats de référence et les tests de propriétés (16.2), et 10 000 combats simulés se terminent tous en moins de 20 ms chacun en moyenne (15.1).

### 4.3 Extraire le contenu du prototype

Le script `tools/extract-prototype` importe les modules du prototype, comme le fait déjà `multijoueur/outils/genere-annexe.ts`, et écrit les fichiers YAML de la section 5. Il est lancé une fois, puis le YAML devient la source. On compare ensuite l'annexe regénérée depuis le YAML à `annexe-contenu.md` : elles doivent être identiques. Le contenu nouveau (régions 6 à 20, capacités, troupes, monstres, évolutions) est saisi à partir des deux fichiers de contenu cible, de préférence par un script qui lit leurs tableaux, puis relu.

### 4.4 L'état du joueur

Le modèle `Game` (README 11.2) est éclaté en tables (section 6). Il n'y a pas de migration des sauvegardes `localStorage` : les comptes en ligne partent de zéro.

---

## 5. Contenu de jeu : format, validation, publication

### 5.1 Fichiers

```
content/
  params.yaml              paramètres du moteur et de l'économie (ECO, GAUGE_MULT, ITEM_BOOST, taxes…)
  damage-types.yaml        types de dégâts, plafonds de résistance
  powers.yaml              les 5 puissances
  weapons.yaml             armes naturelles
  skills/*.yaml            capacités, une famille par fichier
  templates.yaml           gabarits de stats, facteur de taille, gabarits d'évolution
  troops/<region>.yaml     troupes recrutables et leurs formes, par ville
  monsters/<region>.yaml   bestiaire, rares, gardiens
  dungeons/<id>.yaml       monstres spéciaux, boss, table de butin, objets uniques
  items/materials.yaml     matériaux, composants, trophées
  items/bases/*.yaml       bases d'équipement par catégorie, pools de stats
  items/consumables.yaml
  world/regions.yaml       20 régions, villes, thèmes, paliers
  world/routes.yaml        29 routes, étapes, gardiens, rares, porte de donjon
  quests.yaml              paramètres du générateur de quêtes
  strategies.yaml          stratégies par défaut, une par forme (le joueur ne les édite pas)
  texts/fr.yaml            textes affichés (noms, descriptions), clé = identifiant
```

Identifiants textuels stables et préfixés : `troop.garde_champetre`, `skill.javelot_glace`, `route.R14`, `dungeon.tombeau_roi_glaces` [A, 4.3]. Un identifiant n'est jamais supprimé ni réutilisé : il est **déprécié** (il n'apparaît plus en jeu, mais les biens existants restent lisibles).

### 5.2 Validation par `content-cli validate`

Elle refuse le pack si :
- une référence est cassée (capacité, arme, objet, monstre, troupe, région, route) ;
- un identifiant présent dans le pack actif a disparu sans être déprécié ;
- le **graphe du monde** n'a pas 20 régions, si une région a moins de 2 ou plus de 3 routes, si une région est inaccessible depuis Havre-Gris, ou si une route n'a pas exactement 5 étapes et un gardien ;
- un donjon est sur une route absente, ou n'a pas 4 monstres spéciaux et 3 boss ;
- un monstre immunisé contre un type n'a aucune capacité ou cible possible pour le joueur, dans une région où les recrues ne disposent que de ce type (garde-fou d'équilibrage, avertissement seulement) ;
- une forme d'évolution a un niveau hors de 10 ou 20, ou une branche dont la capacité n'existe pas ;
- une recette de recrutement ou d'évolution ne peut pas être satisfaite avec les matériaux trouvables au palier (contrainte des recettes personnelles, README 8.5) ;
- une table de butin est vide ou ne totalise pas 100 % ;
- une forme n'a pas de stratégie par défaut, ou sa stratégie utilise une capacité que la forme n'apprend jamais (README 16, point 5) ;
- un texte manque dans `texts/fr.yaml`.

### 5.3 Simulation et équilibrage

`content-cli simulate` lance N combats par rencontre (chaque étape de chaque route, chaque gardien, salles 1 à 24 de chaque donjon) contre des escouades de référence par palier (définies dans `tools/balance/squads.yaml`). Il produit un rapport : taux de victoire, durée, pertes, or et XP par combat. `content-cli diff` compare deux packs et liste les changements de règles et de valeurs. Les deux rapports sont joints à chaque demande de fusion qui touche `content/`.

### 5.4 Publication

```
content/*.yaml ──validate──► pack compilé (JSON, quelques Mo) + hash SHA-256
               ──publish───► ligne content_pack (immuable) + activation
web et worker ──NOTIFY content_pack──► rechargement en mémoire, bascule atomique
```

- Le pack est publié par la CI depuis la branche principale, après validation et approbation (17.3). Il n'est jamais modifié une fois publié.
- Chaque combat, exemplaire, recette et annonce enregistre la version de contenu utilisée.
- Retour arrière : réactiver le pack précédent. C'est sans danger si aucun identifiant n'a été supprimé.
- Le client reçoit les données publiques du pack (Codex, textes) sous forme d'un fichier statique versionné par son hash, mis en cache par le navigateur.

---

## 6. Modèle de données

Schéma logique. Les types sont indicatifs. Toutes les tables ont `created_at` ; les tables modifiées ont aussi `updated_at` et, quand elles sont verrouillées, `lock_version`.

### 6.1 Comptes et joueurs

- **account** : id, e-mail (unique, en minuscules), hash argon2id, e-mail vérifié le, rôle (`player`, `moderator`, `admin`), secret 2FA (admin), état (`active`, `suspended`, `banned`, `deleted`), date d'acceptation des CGU et leur version.
- **session** : id (aléatoire, 256 bits), compte, créée le, expire le, dernière activité, IP tronquée, agent utilisateur.
- **player** : id, compte (1-1), pseudo (unique, insensible à la casse), **graine secrète** (jamais envoyée au client), position (`kind` : `city` | `route` | `dungeon`, `region_id`, `route_id`, `direction`, `step`, `dungeon_run_id`), niveau d'escouade, `watch_until` (fin du blocage de rediffusion), « disponible pour un donjon » (booléen), dernière activité, `lock_version`.
- **player_recipe** : joueur, type (recrutement, évolution, fabrication), cible, ingrédients figés, version du générateur, version de contenu. Matérialisée au premier contact [A, 7].
- **player_reserved_material** : joueur, matériau (matériaux « inutiles pour vous », README 8.5).

### 6.2 Biens

Conteneurs [A, 5.2] adaptés au jeu cible :

| Conteneur | Contenu | Règle |
|---|---|---|
| `BAG(joueur)` | objets | 20 emplacements, une pile = un emplacement |
| `BANK(joueur)` | objets | commune à toutes les villes, accessible en ville seulement |
| `BARRACKS(joueur)` | troupes non engagées | illimitée, en ville seulement |
| `SQUAD(joueur)` | troupes engagées | 8 unités, 11 de population ; modifiée en ville seulement |
| `EQUIPPED(unité)` | équipement d'une unité | 3 emplacements (ou 4 si la main secondaire est ajoutée) |
| `ESCROW(annonce)` | bien en vente en boutique | |
| `DUNGEON_CHEST(run, joueur)` | butin gagné en donjon | vidé vers `BANK` à la sortie, vers `SYSTEM` en cas de défaite |
| `PENDING_LOOT(joueur)` | butin qui ne tient pas dans le sac | perdu en avançant, en rebroussant, en rentrant ou en arrivant (README 8.6) |
| `GRAVE` | unités et troupes mortes, équipement détruit | |
| `SYSTEM` | source ou puits | |

- **item_stack** : id, conteneur (type + référence), objet, quantité > 0 ; unicité (conteneur, objet).
- **item_instance** : id, base, qualité, stats tirées (JSON), puissance du jet, conteneur, origine (butin, fabrication, achat PNJ, quête, donjon), version de contenu.
- **troop** : id, propriétaire, type, forme actuelle, branche choisie, niveau, XP, conteneur (`BARRACKS`, `SQUAD`, `ESCROW`, `GRAVE`), rang, capacités désactivées (liste d'identifiants), prêtée par la garde (booléen), recrutée le, morte le, `lock_version`.
- **troop_unit** : troupe, numéro d'unité (1 à 3), PV courants, mana courant, morte (booléen). Une table plutôt qu'un tableau, pour que l'équipement pointe une unité.
- **troop_ownership** : troupe, propriétaire, du, au, motif (recrutement, boutique, récompense) [A].
- **asset_move** : journal de chaque mouvement de bien [A, 5.5].

### 6.3 Or

`gold_account` et `gold_entry` en partie double [A, 5.4]. Comptes système : `SOURCE_COMBAT`, `SOURCE_QUEST`, `SOURCE_DUNGEON`, `SOURCE_MERCHANT_BUY` (rachat PNJ), `SINK_MERCHANT_SELL`, `SINK_RECRUIT`, `SINK_EVOLUTION`, `SINK_REBUY_UNIT`, `SINK_CRAFT`, `SINK_SHOP_TAX`. Le séquestre d'or n'est pas nécessaire : les boutiques vendent à prix fixe, payé au moment de l'achat.

### 6.4 Expédition, rencontres, combats

- **expedition** : joueur, route, sens, étape, débutée le, victoires sur la route (sert à l'apparition des rares après 10 victoires).
- **encounter** : id, joueur, route, étape, composition des monstres (JSON), rare (booléen), est un gardien, **graine de composition** (serveur seulement), statut (`visible`, `fought`, `fled`), créée le. Une seule rencontre `visible` par joueur (contrainte d'unicité partielle). Cela ferme la faille `searchFight` (README 13.2, point 3).
- **dungeon_door** : joueur, route, étape, apparue le, statut (`visible`, `opened`, `gone`).
- **battle** : id, type (route, gardien, donjon), entrée complète figée, graine, version du moteur, version de contenu, résultat, journal compressé (zstd ou gzip), durée en instants, date. Partitionnée par mois (15.3).
- **battle_participant** : combat, joueur, récompenses (or, XP, butin) ; deux lignes pour un combat en duo.

### 6.5 Quêtes

- **quest** : id, joueur, ville, sorte (troupe, équipement, monstre rare, trophée de boss de donjon), demande (JSON), récompense (JSON), statut (`offered`, `accepted`, `done`, `expired`), graine de génération. 5 quêtes par ville et par joueur (README 9.2), générées à la première visite puis renouvelées.

### 6.6 Donjons

- **dungeon_run** : id, donjon, route, étape d'origine, ouvreur, mode (`solo`, `duo`), salle actuelle, statut (`lobby`, `between_rooms`, `in_room`, `cleared`, `closed`), invitation (joueur invité ou « au hasard », expire le), votes de la salle suivante (JSON), dernière activité de chaque membre, `lock_version`.
- **dungeon_member** : run, joueur, rôle (`opener`, `guest`), position avant l'entrée (pour le retour), statut (`active`, `left`, `defeated`), sorti le.

### 6.7 Boutiques

- **shop_listing** : id, ville, vendeur, bien (type + référence), quantité, prix total en or, statut (`active`, `sold`, `withdrawn`, `expired`), expire le, champs de recherche dénormalisés (nom, famille, palier, emplacement, niveau pour une troupe), `lock_version`. Index : `(ville, statut, famille, prix)` et un index trigramme sur le nom.
- **shop_sale** : annonce, acheteur, prix, taxe, transaction, date. Sert à l'historique des 20 dernières ventes par objet et par ville (vue matérialisée rafraîchie par le worker, ou requête indexée).

### 6.8 Social et modération

- **friendship** : joueur A < joueur B, statut (`pending_a`, `pending_b`, `accepted`), date.
- **block** : bloqueur, bloqué.
- **chat_message** : id, région, auteur, texte (≤ 300 caractères), liens cités (JSON), supprimé par la modération (booléen), date. Partitionnée par jour, purgée après 7 jours (README 25).
- **direct_message** : id, de, à, texte, lu le, date. Conservation [H] : 90 jours.
- **report** : id, auteur, cible (message, joueur, annonce), motif, statut, traité par, décision.
- **sanction** : joueur, type (`mute`, `shop_ban`, `suspend`, `ban`), motif, du, au, auteur.
- **notification** : id, joueur, type, données, lue le. Les notifications qui doivent survivre à une déconnexion (vente en boutique, message privé, invitation expirée) sont écrites ici.

### 6.9 Technique

`idempotency_key` [A], `content_pack` (id = hash, JSON compressé, publié le, actif), `admin_action` [A], `game_transaction` [A], tables internes de pg-boss.

### 6.10 Invariants vérifiés par la base

Contraintes `CHECK`, `UNIQUE` et `FOREIGN KEY` partout où c'est possible : quantité > 0, solde ≥ 0 hors comptes source, une seule rencontre visible par joueur, un seul `dungeon_run` actif par joueur, pseudo unique, annonce `active` liée à un bien en `ESCROW`. Ce qui ne s'exprime pas en contrainte est vérifié par le worker (19.3).

---

## 7. Commandes et pages

### 7.1 Pages

| Page | Contenu | Rafraîchissement |
|---|---|---|
| Accueil, inscription, connexion | | |
| Ville | services : caserne, atelier, marchand, banque, boutique, quêtes, routes au départ, chat de la région | fragments htmx par service |
| Escouade | 8 emplacements, population, rangs, capacités actives et désactivées, équipement | |
| Route (étape) | décor de la région, groupe en vue, porte de donjon, combattre, avancer, rebrousser, rentrer, sac, consommables | |
| Combat | rediffusion obligatoire, puis résultat, butin, butin en attente | îlot JS |
| Donjon | salle, membres, coffre, votes, combattre, quitter | SSE |
| Boutique | recherche, annonces de la ville, mes annonces, historique des prix | |
| Codex | troupes, monstres, capacités, objets, régions (pack public) | statique |
| Social | amis, messages privés, blocages | SSE |
| Compte | pseudo, e-mail, mot de passe, export et suppression des données | |
| Administration | joueurs, biens, journaux, signalements, sanctions, packs de contenu | |

Chaque page est utilisable sur téléphone (le prototype ne l'est qu'en partie) [H].

### 7.2 Commandes

| Commande | Position exigée | Effets principaux | Débit [H] |
|---|---|---|---|
| `squad.engage` / `squad.withdraw` / `squad.setRank` | ville | `BARRACKS` ↔ `SQUAD`, contrôle 8 / 11 | 60/min |
| `troop.setDisabledSkills` | partout entre deux combats, hors blocage | capacités connues seulement, attaque de base non désactivable (README 20.1) | 30/min |
| `equip` / `unequip` | ville (banque ou sac) ; route (sac seulement) | `EQUIPPED` ↔ `BAG` / `BANK` ; soin au maximum en ville (README 21) | 60/min |
| `consumable.use` | partout entre deux combats | pile − 1, PV ou mana fixes | 60/min |
| `route.depart` | ville, route qui en part | position = étape 1, tirage de porte (2 %) | 10/min |
| `route.advance` / `route.back` / `route.home` | route, aucun combat à regarder | position, tirage de porte, perte du butin en attente | 30/min |
| `encounter.search` | route, aucune rencontre visible | nouvelle `encounter` | 30/min |
| `battle.fight` | route, rencontre visible | combat, résultat, butin, XP, morts (8.2) | 20/min |
| `loot.take` / `loot.discard` | écran de résultat | `PENDING_LOOT` → `BAG` | 60/min |
| `city.arrive` | interne : dernière étape franchie, gardien vaincu | position = ville, **soin automatique**, quêtes générées | |
| `recruit` / `unit.rebuy` | ville qui recrute le type | recette, or, nouvelle troupe ou unité | 20/min |
| `evolve` | ville qui recrute le type, niveau 10 ou 20 | recette, or, forme, capacités proposées | 10/min |
| `craft` | ville | recette personnelle, exemplaire tiré | 30/min |
| `merchant.buy` / `merchant.sell` | ville | grand livre, exemplaire « médiocre » | 60/min |
| `bank.deposit` / `bank.withdraw` | ville | `BAG` ↔ `BANK` | 120/min |
| `quest.accept` / `quest.turnIn` | ville de la quête | | 20/min |
| `shop.list` / `shop.withdraw` / `shop.buy` / `shop.search` | ville de la boutique | section 11 | 20 / 20 / 30 / 60 par min |
| `dungeon.open` / `invite` / `accept` / `decline` / `fight` / `next` / `leave` | section 9 | section 9 | 20/min |
| `chat.send` | partout (canal de la région actuelle) | message diffusé | 1/s, 20/min (README 25) |
| `dm.send` | partout | message, notification | 10/min |
| `friend.request` / `accept` / `remove`, `block`, `report` | partout | | 20/min |
| `account.export` / `account.delete` | | section 14 | 1/jour |

Toutes ces commandes refusent d'agir tant que `now < player.watch_until` (blocage de rediffusion), sauf le chat, les messages privés, le Codex et la consultation.

---

## 8. Expédition, rencontres et rediffusion côté serveur

### 8.1 Aléa

- Chaque joueur a une **graine secrète** tirée par `crypto.randomBytes` à la création du compte (README 26). Elle sert aux tirages qui doivent rester stables pour un joueur : recettes personnelles, matériaux réservés, quêtes. Elle n'est jamais envoyée au client.
- Les tirages de jeu (composition d'une rencontre, porte de donjon, rare, graine d'un combat, butin, jet d'un exemplaire) utilisent une **graine fraîche** tirée par `crypto.randomInt` au moment de la commande, stockée avec l'objet qu'elle produit. On peut ainsi rejouer et auditer, sans que le joueur puisse rien prévoir (README 13.2, points 2 et 6).
- Le moteur et les générateurs ne reçoivent qu'une graine sur 32 bits et le PRNG xoshiro128** du prototype : ils restent déterministes et testables.

### 8.2 Déroulé de `battle.fight`

1. Verrou du joueur, contrôle : position sur la route, rencontre `visible` qui appartient au joueur, `now ≥ watch_until`, escouade non vide avec au moins une unité vivante.
2. Construction de l'entrée : stats finales de chaque unité (niveau, forme, équipement × `ITEM_BOOST`, résistances plafonnées), PV et mana courants, rangs, stratégie par défaut de la forme privée des capacités désactivées, monstres de la rencontre avec le renfort de région.
3. Graine du combat tirée maintenant, puis `simuler(entrée, graine)`.
4. Dans la même transaction : PV et mana restants, +25 % de mana, unités mortes (équipement vers `GRAVE`), troupes sans unité vivante vers `GRAVE`, XP et niveaux, or au grand livre, butin vers `BAG` puis `PENDING_LOOT`, rencontre passée à `fought`, ligne `battle`, `watch_until` calculé.
5. Après le commit, redirection vers la page du combat, qui charge le journal.

Un combat ne peut pas être relancé pour obtenir un meilleur tirage, puisque le tirage et l'application sont dans la même transaction [A, 6.4].

### 8.3 Blocage de rediffusion

La rediffusion est obligatoire (README 10.2). Le serveur fixe `watch_until = now + durée_du_combat_en_instants × 10 ms ÷ vitesse de lecture maximale autorisée` [H, point ouvert 2 du README]. Le bouton « Continuer » n'a pas besoin d'appeler le serveur : les commandes sont simplement refusées tant que le délai n'est pas écoulé, et l'interface affiche le temps restant.

### 8.4 Défaite et entrée en ville

Une défaite totale (aucune unité vivante) ou un retour en ville appelle `city.arrive` dans la même transaction : position = ville de la région, toutes les troupes à PV et mana maximum, butin en attente perdu, rencontre et porte effacées. Si le joueur n'a plus aucune troupe, la garde lui prête un Milicien (README 4.6).

---

## 9. Donjons et duo

### 9.1 Cycle de vie d'un donjon

```
porte visible ──open──► lobby ──(solo, ou invité qui accepte, ou 60 s écoulées)──► entre deux salles
                          │                                                          │
                          └──(invitation refusée ou expirée : choix solo ou fermer)  │
                                                                                     ▼
          ┌──────────── leave (un membre sort avec son coffre) ◄───────── entre deux salles
          │                                                                │   ▲
          ▼                                                     next (tous) │   │ victoire
        closed ◄── défaite (coffre perdu, retour en ville, soin) ◄─ en salle ┘   │
                                                                   └─────────────┘
```

- `dungeon.open` : la porte de l'étape devient un `dungeon_run` (`lobby`). La position de l'ouvreur passe à `dungeon`.
- `dungeon.invite` : un ami dans la même région (vérifié au serveur avec la position), ou une **invitation au hasard** envoyée par SSE à au plus 20 joueurs de la région marqués « disponibles », hors combat et hors donjon, tirés au hasard. Le premier `dungeon.accept` gagne : la commande verrouille le `dungeon_run`, vérifie qu'il n'a pas déjà d'invité et que l'invitation n'a pas expiré. Les autres voient « déjà pris ».
- Une tâche pg-boss programmée à l'expiration (60 s) passe l'invitation à `expired` si personne n'a accepté.
- Chaque salle est un combat (`dungeon.fight`), puis on revient à `between_rooms`.
- `dungeon.next` : en duo, chaque membre vote. Quand tous les membres actifs ont voté, la salle suivante est générée. `dungeon.leave` fait sortir le membre avec son coffre (livré en `BANK`). L'autre peut continuer seul : les salles suivantes sont dimensionnées pour une escouade.
- **Absence** : une tâche vérifie chaque minute les membres sans activité depuis plus de 5 minutes et applique `leave` pour eux (README 26).

### 9.2 Concurrence

- Toute commande de donjon verrouille **les lignes `player` des membres par ordre d'id croissant**, puis le `dungeon_run` (`FOR UPDATE`) [A, 8.3]. Deux votes simultanés, ou un vote et une sortie, ne peuvent donc pas s'entrelacer.
- `lock_version` sur le `dungeon_run` est renvoyé aux pages : une action envoyée sur un état périmé (« salle suivante » alors que l'autre est déjà sorti) est refusée avec un message clair, et la page se met à jour.
- Le combat d'une salle de duo est lancé par le **second vote** ou par `dungeon.fight` de n'importe quel membre (au choix de design [H] : le combat se lance dès que les deux ont voté « salle suivante », sans clic de plus).

### 9.3 Combat en duo

- Entrée du moteur : un camp de 16 emplacements au plus et 22 de population, les unités de l'ouvreur d'abord, chaque unité portant son `owner`. Le moteur ignore les propriétaires, sauf pour le journal et le résultat.
- Monstres : population × 2, 16 emplacements au plus (README 23.3).
- Le résultat est appliqué **par propriétaire** : PV, morts, XP, or et butin de chaque joueur, chacun avec sa propre graine de butin. Butin vers `DUNGEON_CHEST(run, joueur)`.
- Défaite : chaque membre perd son coffre (transfert vers `SYSTEM`, motif « défaite en donjon »), retourne dans la ville de sa région et y est soigné.
- Rediffusion obligatoire pour les deux. Chacun a son `watch_until`.

### 9.4 Difficulté, butin, quêtes

Les formules du README 23.5 et 23.6 sont dans `packages/gen/dungeon.ts`, avec leurs paramètres dans `params.yaml`. Les trophées de boss sont des objets empilables comme les autres : ils peuvent être vendus en boutique et rendus en quête.

**Fini quand** : un test d'intégration joue un duo complet (invitation au hasard, 9 salles avec 2 boss, sortie de l'un à la salle 6, défaite de l'autre à la salle 9). Il vérifie les coffres, les morts, l'or au grand livre et la conservation des biens, et rejoue chaque combat depuis sa ligne `battle`.

---

## 10. Temps réel : notifications, chat, présence

### 10.1 Un seul flux SSE par onglet

- `GET /events` ouvre un flux Server-Sent Events authentifié par le cookie de session. Il est abonné à `user:<id>`, à `region:<id>` (chat de la région actuelle) et à `dungeon:<id>` le cas échéant.
- Changement de région : la commande qui déplace le joueur envoie un événement `resubscribe`, et le serveur met à jour les abonnements du flux.
- Le flux envoie un battement toutes les 25 s, pour que les proxys ne coupent pas la connexion. À la reconnexion, `Last-Event-ID` permet de renvoyer ce qui a été manqué depuis la table (`chat_message`, `notification`).
- Côté navigateur, l'extension SSE de htmx insère directement des fragments HTML : message de chat, toast, état du donjon.

### 10.2 Diffusion entre exemplaires `web`

- Après le commit, la commande fait `NOTIFY` sur le canal Postgres `events` avec une charge utile courte (`{topic, id}`), car NOTIFY est limité à 8 000 octets.
- Chaque exemplaire `web` garde une connexion `LISTEN` dédiée, relit l'objet si besoin et l'envoie aux flux abonnés au sujet.
- Il faut une connexion directe pour `LISTEN`, pas une connexion à travers un pooler en mode transaction. On prévoit une connexion dédiée par exemplaire.

### 10.3 Présence

- `player.last_seen_at` est mis à jour à chaque requête, et au plus une fois par minute par le flux SSE.
- « En ligne » = vu depuis moins de 2 minutes. Les amis voient le statut et la région (README 25).

### 10.4 Limites et passage à l'échelle

Un exemplaire Node tient sans difficulté quelques milliers de flux SSE inactifs. Si le nombre de joueurs connectés en même temps dépasse 5 000, ou si NOTIFY devient un goulot (mesuré en 15.4), on remplace LISTEN/NOTIFY par un bus dédié (NATS ou Redis Pub/Sub) derrière la même interface `publish(topic, payload)`. Le reste du code ne change pas.

---

## 11. Boutiques des joueurs

### 11.1 Commandes

- **`shop.list`** (en ville) : contrôles (bien en `BANK` ou `BARRACKS`, troupe non engagée et non prêtée, prix ≥ prix de rachat PNJ, moins de 20 annonces actives, sanction `shop_ban` absente, compte de plus de 24 heures pour une troupe). Le bien est transféré vers `ESCROW(annonce)`. L'annonce est créée avec une expiration à 7 jours, et une tâche d'expiration est programmée.
- **`shop.buy`** (dans la ville de l'annonce) : verrou des deux joueurs par ordre d'id, puis de l'annonce. Contrôles : statut `active`, l'acheteur n'est pas le vendeur, or suffisant, place disponible. Ensuite, dans la même transaction : or acheteur → vendeur, taxe de 5 % → `SINK_SHOP_TAX`, bien `ESCROW` → `BANK` ou `BARRACKS` de l'acheteur, `troop_ownership` mis à jour, `shop_sale` créée, annonce passée à `sold`, notification au vendeur. Deux achats simultanés : le second attend le verrou, puis voit `sold` et reçoit « déjà vendu ».
- **`shop.withdraw`** (dans la ville de l'annonce) : bien retourné au vendeur.
- **Expiration** (worker) : retour au vendeur, notification. Elle est idempotente : si l'annonce n'est plus `active`, la tâche ne fait rien.

### 11.2 Recherche

Requête paginée par curseur (prix, id) sur l'index `(ville, statut, famille, prix)`, filtres sur le palier et l'emplacement, recherche de nom par trigramme. La fiche d'un exemplaire montre ses stats tirées et leur comparaison avec l'équipement actuel de l'unité choisie. Historique : prix des 20 dernières ventes de cet objet dans la ville, et leur moyenne.

### 11.3 Anti-abus

- Le prix minimal égal au rachat PNJ empêche de transférer de l'or entre deux comptes à 1 or.
- Le worker signale les ventes très au-dessus de la moyenne entre deux comptes qui partagent une IP ou un appareil, et les chaînes de propriétaires d'une même troupe (13.4).

---

## 12. Social et modération

- **Chat de région** : texte brut ≤ 300 caractères, échappé au rendu (jamais de HTML venant d'un joueur). Les liens vers un objet, une troupe ou une annonce sont insérés par un sélecteur, stockés comme références, et rendus par le serveur en fiche consultable. Les messages d'un joueur bloqué sont masqués pour celui qui l'a bloqué. Filtre de mots configurable (liste dans le pack ou en base), qui masque le mot et compte l'infraction.
- **Messages privés** : refusés si le destinataire a bloqué l'expéditeur. Notification si le destinataire est hors ligne.
- **Signalement** : bouton sur chaque message, profil et annonce. Le signalement copie le contenu signalé, au cas où il serait supprimé.
- **Outils de modération** : file des signalements, historique d'un joueur, sanctions (sourdine, interdiction de boutique, suspension, bannissement) avec durée et motif, journalisées dans `admin_action`.
- **Pseudos** : 3 à 20 caractères, lettres, chiffres, tiret et espace, liste de pseudos interdits, renommage forcé possible par un modérateur.

---

## 13. Sécurité et anti-triche

### 13.1 Web

- HTTPS uniquement, HSTS (avec `preload` une fois le domaine stable).
- Cookie de session `__Host-` avec `Secure`, `HttpOnly`, `SameSite=Lax`. Rotation de l'identifiant à la connexion. Expiration glissante de 30 jours, révocation des sessions depuis la page Compte.
- Jeton CSRF sur toutes les requêtes qui modifient l'état, envoyé par htmx dans un en-tête (`hx-headers`), et vérification de l'en-tête `Origin`.
- CSP stricte : `default-src 'self'`, aucun script en ligne (nonces si besoin), `frame-ancestors 'none'`. Plus `X-Content-Type-Options`, `Referrer-Policy` et `Permissions-Policy`.
- Échappement automatique dans les templates. Aucun `innerHTML` venant d'un joueur.
- Limitation de débit par compte et par IP (table 7.2) : compteur en mémoire par exemplaire, plus un garde-fou global en base pour les commandes sensibles (connexion, achat).
- Connexion : argon2id (paramètres OWASP du moment), limitation et ralentissement après des échecs, pas d'énumération des comptes (même message dans tous les cas), vérification de l'e-mail avant d'accéder aux boutiques et au chat.

### 13.2 Serveur autoritaire

Le client n'envoie que des intentions validées par Zod. Les stats, prix, positions, graines et résultats sont calculés au serveur [A, A10]. Chaque commande vérifie la position et les services de la ville. Le Labo du prototype et la « nouvelle partie avec graine » sont réservés à l'administration (README 13.1).

### 13.3 Dépendances et secrets

- Renovate ou Dependabot, `pnpm audit` en CI, analyse de l'image (Trivy), CodeQL ou équivalent.
- Secrets (URL de la base, clés e-mail et observabilité, secret HMAC des recettes, secret des sessions) dans le gestionnaire de secrets de l'hébergeur, jamais dans le dépôt. Une analyse de secrets tourne en CI (gitleaks).
- Rôles Postgres séparés : `migrator` (DDL), `app` (DML seulement, sans `DROP` ni `TRUNCATE`), `readonly` (support, analyses).

### 13.4 Triche et multi-comptes

- Signaux collectés dès le lancement : IP tronquée, empreinte d'appareil légère (cookie long et agent utilisateur), transferts déséquilibrés entre deux comptes, prix loin de la moyenne, chaînes de propriétaires.
- **Bots** : rythme de commandes très régulier sur de longues durées, détecté par une requête du worker. La revue reste manuelle au début.
- Comptes neufs : pas de vente de troupe avant 24 heures, et un plafond d'or vendu par jour pendant 7 jours [H].
- L'administration utilise la 2FA (TOTP), des routes séparées, et chaque action est tracée.

---

## 14. Données personnelles et obligations légales

À faire valider par un juriste avant le lancement. Les points ci-dessous sont la base attendue pour un jeu en ligne gratuit édité depuis la France [H].

- **Hébergement dans l'Union européenne**, base et sauvegardes comprises. Les sous-traitants (hébergeur, e-mail, outil d'erreurs) sont listés dans la politique de confidentialité, avec leurs accords de traitement.
- **Données collectées** : e-mail, pseudo, hash du mot de passe, IP tronquée, données de jeu, messages. Pas de nom réel, pas de date de naissance, pas de traceur publicitaire.
- **Cookies** : seulement les cookies nécessaires (session, CSRF, préférences), donc pas de bandeau de consentement. Si une mesure d'audience est ajoutée, prendre un outil exempté de consentement selon les critères de la CNIL, ou ajouter le bandeau.
- **Droits** : page Compte avec export des données (JSON) et suppression du compte. La suppression anonymise le joueur (pseudo remplacé, e-mail effacé, messages privés supprimés) mais garde les lignes du grand livre et des mouvements de biens, indispensables à l'intégrité de l'économie, sans donnée personnelle.
- **Conservation** : chat 7 jours, messages privés 90 jours [H], journaux de combat complets 30 jours puis résumé (15.3), journaux techniques 30 jours, IP 12 mois au plus.
- **Âge** : en France, le consentement au traitement des données est valable seul à partir de 15 ans. Comme le jeu a un chat, il faut fixer un âge minimal dans les CGU (par exemple 15 ans, ou 13 ans avec accord parental), à décider (section 22).
- **Documents** : mentions légales (éditeur, hébergeur), CGU (règles de conduite, sanctions, absence de valeur réelle des biens du jeu, interdiction de la vente contre de l'argent réel), politique de confidentialité, page de contact.
- **Contenu publié par les joueurs** (chat, pseudos, annonces) : le règlement européen sur les services numériques (DSA) impose au minimum un moyen de signaler un contenu illicite, une décision motivée en cas de sanction, et un point de contact. Les outils de la section 12 y répondent.

---

## 15. Performance et capacité

### 15.1 Objectifs [H]

| Mesure | Objectif |
|---|---|
| Commande simple (p95, côté serveur) | < 80 ms |
| `battle.fight` complet (p95), moteur compris | < 200 ms |
| Moteur seul, 32 unités, 3 000 instants | < 20 ms en moyenne, < 60 ms au p99 |
| Page complète (p95, première octet) | < 150 ms |
| Message de chat, de l'envoi à l'affichage chez les autres | < 500 ms |
| Disponibilité mensuelle | 99,5 % en V1 |

Hypothèse de charge au lancement : 2 000 joueurs inscrits, 300 connectés en même temps, 1 combat toutes les 20 s par joueur actif, soit environ 15 combats par seconde au pic. Deux exemplaires `web` de taille modeste suffisent largement. La base est le seul composant à surveiller.

### 15.2 Le moteur hors du fil principal

Un combat de duo de 32 unités peut prendre plusieurs dizaines de millisecondes et bloquer la boucle d'événements Node pendant ce temps. On l'exécute dans un **pool de workers threads** (Piscina) de la taille du nombre de cœurs. La transaction reste ouverte pendant le calcul, ce qui est acceptable à ces durées. Le contrôle et l'application restent dans le fil principal.

### 15.3 Volume des combats

Un journal fait de quelques dizaines à quelques centaines de Ko avant compression (README 16, point 10), et 5 à 10 fois moins après. À 15 combats par seconde au pic et environ 300 000 combats par jour en moyenne, cela représente plusieurs Go par mois. D'où :
- la table `battle` est partitionnée par mois ;
- le journal complet est gardé 30 jours [H], puis remplacé par un résumé (résultat, récompenses, entrée et graine). Le combat reste rejouable par le moteur de la même version, qui est conservé ;
- option : les journaux anciens vont dans un stockage objet plutôt qu'en base.

### 15.4 Tests de charge

Scénarios k6 sur la préproduction, avec des données de taille réaliste (100 000 combats, 50 000 annonces) :
1. boucle d'expédition : avancer, chercher, combattre, prendre le butin ;
2. boutique : recherche et achats concurrents d'une même annonce ;
3. chat : 500 flux SSE dans une région, 5 messages par seconde ;
4. duo : 50 donjons en parallèle.

On les lance avant la bêta et avant le lancement. Les résultats sont comparés aux objectifs de 15.1.

---

## 16. Stratégie de tests

### 16.1 Pyramide

| Niveau | Outil | Ce qui est testé | Quand |
|---|---|---|---|
| Unitaires | Vitest | formules, générateurs, choix des capacités actives, calcul des stats | à chaque push |
| Moteur, référence | Vitest | combats de référence `golden/v0.4` et `golden/v1` | à chaque push |
| Moteur, propriétés | fast-check | termine toujours, jauges dans leurs bornes, temps croissant, même graine donc même journal, immunité donc 0 dégât | à chaque push (1 000 cas), la nuit (100 000) |
| Contenu | content-cli | validation complète du pack, simulation d'équilibrage rapide | à chaque push touchant `content/` |
| Intégration | Vitest + Testcontainers (Postgres réel) | chaque commande : succès, chaque erreur métier, idempotence, position | à chaque push |
| Concurrence | Vitest, requêtes parallèles | 2 achats d'une annonce, double clic sur combattre, 2 votes de donjon, sortie et vote simultanés, expiration pendant un achat | à chaque push |
| Conservation | propriétés sur la base | après N commandes aléatoires de plusieurs joueurs : or conservé, aucun bien à deux endroits, invariants de 19.3 | la nuit |
| Bout en bout | Playwright | parcours : inscription, première route, combat, butin, recrutement, vente et achat en boutique, donjon en duo à deux navigateurs, chat | avant chaque mise en production |
| Charge | k6 | 15.4 | avant la bêta, avant le lancement, puis à chaque gros changement |
| Sécurité | OWASP ZAP (analyse de base), revue manuelle | en-têtes, CSRF, injections, contrôle d'accès entre joueurs | avant le lancement |

### 16.2 Règles

- Une commande sans test d'intégration n'est pas fusionnée.
- Un changement de comportement du moteur demande une nouvelle version du moteur et des combats de référence régénérés et relus.
- Les tests d'intégration utilisent la vraie base et les vraies migrations, jamais de faux en mémoire.
- Objectif de couverture : 90 % sur `engine`, `gen` et `domain/transfer` ; pas d'objectif chiffré ailleurs.

---

## 17. Environnements, intégration et déploiement continus

### 17.1 Environnements

| Environnement | Rôle | Données |
|---|---|---|
| Local | développement | `docker compose` : Postgres, Mailpit (e-mails), application en mode surveillance ; `seed-dev` crée des joueurs et des biens |
| CI | tests | Postgres jetable (Testcontainers) |
| Préproduction | recette, tests de charge, répétition des migrations | données synthétiques, ou copie anonymisée de la production |
| Production | joueurs | |

Chaque environnement a son domaine, sa base, ses secrets et son pack de contenu actif.

### 17.2 Pipeline (GitHub Actions)

À chaque demande de fusion :
1. installation (`pnpm install --frozen-lockfile`), cache ;
2. `tsc`, ESLint, dependency-cruiser, Prettier ;
3. tests unitaires, moteur et propriétés ;
4. si `content/` a changé : validation, simulation et différence du pack, publiés en commentaire de la demande ;
5. tests d'intégration et de concurrence (Postgres en service) ;
6. construction de l'image, analyse Trivy, gitleaks.

À la fusion sur `main` :
7. publication de l'image (étiquetée par le SHA du commit) dans le registre de l'hébergeur ;
8. déploiement automatique en préproduction : migrations, puis application, puis tests Playwright de fumée ;
9. **mise en production sur approbation manuelle** (environnement protégé de GitHub) : migrations, puis déploiement progressif, puis contrôle de santé, puis tests de fumée.

### 17.3 Contenu

Le pack suit le même chemin, séparément du code : validation en CI, publication en préproduction à la fusion, puis activation en production sur approbation. Le pack déclare la version minimale du moteur qu'il exige. Le serveur refuse d'activer un pack trop récent pour son code.

### 17.4 Migrations sans coupure

Méthode « élargir puis réduire » : (1) ajouter la colonne ou la table, compatible avec l'ancien code ; (2) déployer le code qui écrit les deux formes ; (3) reprendre les données par une tâche ; (4) basculer la lecture ; (5) supprimer l'ancienne forme dans une version suivante. Une migration est toujours testée sur la préproduction avant la production. Délai de verrou court (`SET lock_timeout = '5s'`), index créés avec `CONCURRENTLY`.

### 17.5 Mise en production et retour arrière

- Déploiement progressif ou bleu-vert selon l'hébergeur. Le contrôle de santé `/health` vérifie l'accès à la base et le chargement du pack.
- Arrêt propre : sur `SIGTERM`, l'exemplaire n'accepte plus de requêtes, termine les transactions en cours, ferme les flux SSE (les navigateurs se reconnectent sur un autre exemplaire), puis s'arrête.
- Retour arrière : redéployer l'image précédente. C'est possible parce que les migrations sont rétrocompatibles. Le contenu se retourne en réactivant le pack précédent.
- Mode maintenance : une variable qui fait répondre une page d'attente à toutes les routes du jeu, pour les opérations exceptionnelles.

---

## 18. Hébergement

### 18.1 Besoins

- Conteneurs gérés : au moins 2 exemplaires `web` et 1 `worker`, déploiement sans coupure, connexions longues (SSE) acceptées sans délai d'expiration court.
- PostgreSQL géré : sauvegardes automatiques, **restauration à un instant donné (PITR)**, haute disponibilité (réplique de secours), choix de la version majeure, extensions `pg_trgm` et `pg_stat_statements`, connexions directes pour LISTEN.
- Région dans l'Union européenne, gestion des secrets, registre d'images, journaux, certificats TLS automatiques.

### 18.2 Options

| Option | Exemples | Pour | Contre |
|---|---|---|---|
| A. Plateforme gérée (PaaS) | Clever Cloud (France), Render (région Francfort), Fly.io (région Paris ou Francfort) | presque aucune exploitation, déploiement depuis l'image ou le dépôt | Vérifier la PITR et la haute disponibilité de leur Postgres, et le délai maximal des connexions longues |
| B. Cloud européen, services gérés | Scaleway (base PostgreSQL gérée + conteneurs ou instances), OVHcloud | contrôle, prix, souveraineté | un peu plus d'infrastructure à décrire (répartiteur, réseau privé) |
| C. Serveurs loués | Hetzner + Postgres installé soi-même | le moins cher | sauvegardes, PITR, haute disponibilité et mises à jour à sa charge : déconseillé pour une économie non réversible |

**Recommandation [H] : option A ou B, avec un Postgres géré qui offre la PITR et une réplique de secours.** Le choix final se fait sur une grille courte : PITR, haute disponibilité, durée maximale d'une connexion SSE, région UE, coût. On teste chaque candidat avec la préproduction pendant une journée. L'infrastructure est décrite dans `infra/deploy/` (fichier de l'hébergeur ou Terraform), pour pouvoir changer d'hébergeur.

### 18.3 Ordre de grandeur des coûts au lancement

À vérifier sur les grilles du moment. Comptez quelques dizaines à environ 150 € par mois : 2 petits conteneurs `web`, 1 `worker`, un Postgres géré de petite taille avec réplique, l'e-mail transactionnel (souvent gratuit en dessous de quelques milliers d'e-mails par mois), l'outil d'erreurs (offre gratuite, ou GlitchTip auto-hébergé), le stockage des sauvegardes et le domaine. La base est le poste qui grossit en premier, à cause des journaux de combat (15.3).

### 18.4 Domaine et e-mail

Nom de domaine à choisir (section 22). DNS chez un fournisseur avec DNSSEC. Enregistrements SPF, DKIM et DMARC pour l'e-mail. Le site est en `https://` seulement, avec redirection.

### 18.5 Sauvegardes

- PITR de l'hébergeur, avec 7 à 14 jours de rétention.
- En plus : un `pg_dump` chiffré (age ou GPG) chaque nuit vers un stockage objet **chez un autre fournisseur ou dans une autre région**, gardé 30 jours, plus une sauvegarde mensuelle gardée 12 mois.
- **Test de restauration mensuel** : restaurer en préproduction, lancer les contrôles d'invariants, mesurer le temps. Une sauvegarde jamais restaurée ne compte pas.
- Objectifs [H] : perte de données maximale (RPO) de 5 minutes avec la PITR, remise en service (RTO) en moins de 2 heures.

---

## 19. Observabilité et exploitation

### 19.1 Journaux, métriques, traces

- Journaux JSON (pino) avec l'id de requête, l'id de joueur, la commande et l'id de transaction. Jamais de mot de passe, de jeton ni d'e-mail en clair.
- Métriques OpenTelemetry : latence et taux d'erreur par commande, combats par minute, durée du moteur, flux SSE ouverts, profondeur des files pg-boss, connexions à la base, requêtes lentes, achats en boutique, or créé et détruit par heure.
- Traces : une trace par commande, avec les requêtes SQL et l'appel au moteur.
- Erreurs : Sentry ou GlitchTip, avec la version de l'image et celle du pack.
- Destination : l'outil de l'hébergeur, ou Grafana Cloud et son offre gratuite [H].

### 19.2 Alertes

| Alerte | Seuil [H] | Gravité |
|---|---|---|
| Violation d'un invariant (19.3) | une seule | critique : enquête immédiate, gel des boutiques si l'or ou des biens sont concernés |
| Taux d'erreurs 5xx | > 2 % sur 5 min | haute |
| Latence p95 des commandes | > 500 ms sur 10 min | moyenne |
| Site injoignable (sonde externe) | 2 échecs consécutifs | haute |
| File pg-boss en retard | > 5 min | moyenne |
| Base : CPU, stockage, connexions | > 80 % | moyenne |
| Sauvegarde nocturne absente | une nuit | haute |
| Création d'or anormale | > 3 fois la moyenne horaire | haute |

### 19.3 Contrôles d'invariants (worker, toutes les 10 minutes et la nuit)

Repris de l'architecture [A, 8.5] et adaptés :
- le grand livre est cohérent avec les soldes, et sources − puits = somme des soldes ;
- aucun bien dans deux conteneurs, aucune pile ≤ 0, aucun bien dans un conteneur invalide ;
- chaque escouade a au plus 8 unités et 11 de population ;
- toute troupe d'un joueur en ville est à pleins PV et plein mana ;
- toute annonce `active` a son bien en `ESCROW`, et aucun `ESCROW` n'est orphelin ;
- aucun `DUNGEON_CHEST` non vide pour un donjon `closed` ;
- au plus une rencontre visible et un donjon actif par joueur ;
- échantillon de 100 combats de la veille rejoués : journal identique.

### 19.4 Tableaux de bord

Un tableau technique (latences, erreurs, base, files, SSE) et un tableau de jeu : joueurs actifs, combats, taux de victoire par route, morts, or créé et détruit, prix moyens par ville, volume des boutiques, donjons ouverts, salle maximale atteinte, messages de chat et signalements. Le tableau de jeu sert à l'équilibrage après le lancement.

### 19.5 Procédures (dans `infra/runbooks/`)

1. Incident : qualifier, mode maintenance si l'économie est menacée, communiquer, corriger, faire un post-mortem.
2. Restauration à un instant donné.
3. Retour arrière du code ou du contenu.
4. Correction d'un bien ou d'un solde : toujours par une commande d'administration tracée, jamais par un `UPDATE` à la main [A, 5.8].
5. Sanction et traitement d'un signalement.
6. Rotation d'un secret.
7. Demande RGPD (export, suppression).

---

## 20. Feuille de route par jalons

Chaque jalon finit par quelque chose de jouable ou de vérifiable. Les durées sont des estimations pour un développeur à plein temps, aidé d'une IA de code ; elles sont à recalibrer après le jalon 1 [H].

| Jalon | Contenu | Fini quand | Estimation |
|---|---|---|---|
| **J0. Socle** | monorepo, CI, Docker de développement, Fastify et htmx, base, migrations, comptes et sessions, squelette de commande (3.3), journaux | inscription, connexion et page vide déployées en préproduction | 2 semaines |
| **J1. Moteur et contenu** | portage du moteur et des combats de référence v0.4, corrections du README 16, moteur v1, `packages/gen`, format YAML, extraction du prototype, content-cli | combats de référence verts, pack du prototype compilé, annexe identique | 3 à 4 semaines |
| **J2. Boucle solo** | position, villes, routes du graphe, rencontres, combat, rediffusion et blocage, butin, sac, banque, soin à l'entrée en ville, marchand, consommables, Codex | parcours Playwright : Havre-Gris → première route → gardien → ville suivante | 4 semaines |
| **J3. Progression** | recrutement et recettes personnelles, rachat d'unités, prêt de la garde, atelier, équipement et exemplaires, évolutions, capacités désactivables, quêtes, rares | les 5 régions du prototype jouables en ligne comme dans le prototype | 4 semaines |
| **J4. Contenu cible** | saisie et validation des 15 régions, 90 troupes, 228 monstres, 60 capacités, équipement ; première passe d'équilibrage par simulation | pack cible validé, rapport de simulation acceptable pour chaque palier | 3 à 4 semaines, en partie parallèle à J3 |
| **J5. Boutiques** | annonces, achat, retrait, expiration, recherche, historique, notifications, anti-abus | tests de concurrence et de conservation verts, parcours Playwright entre deux comptes | 2 à 3 semaines |
| **J6. Social** | SSE, chat de région, messages privés, amis, blocage, présence, signalements, modération | chat entre deux navigateurs, sanctions appliquées | 2 à 3 semaines |
| **J7. Donjons** | portes, solo puis duo, invitations, votes, minuteries, coffre, boss, quêtes de donjon | test de duo complet (9.4) et parcours Playwright à deux navigateurs | 3 à 4 semaines |
| **J8. Durcissement** | sécurité (13), RGPD et documents légaux (14), tests de charge (15), observabilité et alertes (19), sauvegardes et test de restauration, procédures | check-list 21 cochée sauf l'ouverture | 2 à 3 semaines |
| **J9. Bêta fermée** | 30 à 100 joueurs invités, collecte des retours, équilibrage, correction des bogues ; l'économie est remise à zéro à la fin de la bêta | 2 semaines sans violation d'invariant ni incident critique | 4 à 6 semaines |
| **J10. Lancement** | ouverture des inscriptions, surveillance renforcée la première semaine | | |

Total indicatif : 8 à 10 mois jusqu'à la bêta fermée. Ordre conseillé : J0 → J1 → J2 → J3, puis J4 en parallèle de J5 et J6, puis J7, J8, J9. Les donjons viennent après les boutiques et le social, parce qu'ils utilisent les invitations, la présence et le SSE.

---

## 21. Check-list de mise en production

**Produit**
- [ ] Toutes les commandes de 7.2 ont leurs tests d'intégration.
- [ ] Pack de contenu cible validé, rapport d'équilibrage relu par Xavier.
- [ ] Parcours Playwright verts en préproduction.
- [ ] Points ouverts du README (27) et de ce document (22) tranchés.

**Sécurité**
- [ ] En-têtes, CSP, CSRF et cookies vérifiés (analyse ZAP sans alerte haute).
- [ ] Limitations de débit actives, verrouillage après échecs de connexion.
- [ ] Administration protégée par 2FA, rôles de base séparés, secrets hors du dépôt.
- [ ] Dépendances et image sans vulnérabilité critique connue.

**Données**
- [ ] PITR active, sauvegarde externe chiffrée, **restauration testée** et chronométrée.
- [ ] Contrôles d'invariants actifs et alertes reçues (test volontaire d'une violation en préproduction).
- [ ] Purges (chat, messages privés, journaux de combat, sessions) programmées.

**Exploitation**
- [ ] Tableaux de bord et alertes branchés, sonde externe active.
- [ ] Procédures écrites et répétées une fois (restauration, retour arrière, incident).
- [ ] Tests de charge conformes aux objectifs de 15.1.
- [ ] Déploiement sans coupure vérifié pendant un test de charge.

**Légal**
- [ ] Mentions légales, CGU, politique de confidentialité et contact publiés.
- [ ] Export et suppression de compte fonctionnels.
- [ ] Signalement, décision motivée et point de contact en place (DSA).
- [ ] SPF, DKIM et DMARC configurés, e-mails reçus hors des indésirables.

**Lancement**
- [ ] Économie remise à zéro après la bêta.
- [ ] Communication prête (page d'accueil, règles, canal pour signaler les bogues).
- [ ] Une personne d'astreinte pour la première semaine.

---

## 22. Points à trancher

1. **Réserve de troupes : tranché par Xavier le 3 novembre 2026.** Il n'y a pas de réserve. La caserne reste en ville, sans limite, et les troupes ne s'engagent qu'en ville. La réserve prévue en Q-A4 est abandonnée.
2. **Hébergeur : tranché par Xavier le 3 novembre 2026.** Render (option A), région Francfort. La grille de la section 18 reste à vérifier avant la production : voir `infra/deploy/README.md`.
3. **Nom du jeu et domaine.**
4. **Âge minimal** des joueurs, à cause du chat (section 14).
5. **Durée de rediffusion** imposée (8.3, point ouvert 2 du README).
6. **Conservation** des messages privés (90 jours proposés) et des journaux de combat complets (30 jours proposés).
7. **Lancement du combat en duo** : automatique dès que les deux ont voté « salle suivante » (proposé), ou par un clic de plus.
8. **Mobile** : pages utilisables sur téléphone dès la V1 (proposé), ou bureau seulement.
9. **Remise à zéro** de l'économie après la bêta (proposée).

Les points ouverts de gameplay restent ceux de la section 27 du README.
