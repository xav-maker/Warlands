# Déploiement sur Render

Hébergeur retenu par Xavier le 3 novembre 2026 (guide 22, point 2). Région : Francfort.

| Fichier               | Rôle                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `render-preprod.yaml` | Blueprint de la préproduction : `cr-preprod-web`, `cr-preprod-worker`, `cr-preprod-db`            |
| `deploy-render.sh`    | appelé par la CI : déploie l'image du commit, attend qu'elle serve, puis lance les tests de fumée |

## Chaîne de déploiement

À chaque fusion sur `main`, la CI (`.github/workflows/ci.yml`) :

1. construit l'image `ghcr.io/<propriétaire>/cinq-regions:<sha>`, qui porte son SHA dans `APP_VERSION` ;
2. l'analyse avec Trivy, puis la publie dans ghcr.io ;
3. appelle le crochet de déploiement du service web avec `imgURL=<image>`. Render passe d'abord les migrations (`preDeployCommand`), puis bascule sans coupure une fois que `/health` répond ;
4. attend que `/health` renvoie `version = <sha>` (15 minutes au plus) ;
5. déploie le worker sur la même image ;
6. vérifie `/`, `/inscription`, `/connexion` (200) et `/ville` sans session (302).

Les déploiements de préproduction passent l'un après l'autre (`concurrency`). Un échec arrête la chaîne. L'ancienne version continue alors de servir, sauf si les migrations sont déjà passées : c'est pour cela qu'elles doivent rester compatibles avec l'ancien code (guide 17.4).

## Mise en place (une fois)

1. **Dépôt GitHub.** Pousser le dépôt et faire passer la CI une fois sur `main`. Le job `deploy-preprod` échouera tant que les étapes suivantes ne sont pas faites ; c'est attendu. L'image `ghcr.io/<propriétaire>/cinq-regions:<sha>` existe alors.
2. **Accès de Render à ghcr.io.** L'image est publique (le dépôt l'est aussi, et l'image ne contient aucun secret) : aucun identifiant n'est nécessaire. Si elle redevenait privée, il faudrait un jeton GitHub _classic_ `read:packages`, déclaré dans Render (_Workspace Settings → Container Registry Credentials_), et un bloc `creds` dans le Blueprint.
3. **Blueprint.** `render-preprod.yaml` pointe sur une image déjà publiée (les déploiements suivants la remplacent par celle du commit). Dans Render, choisir _New → Blueprint_, prendre le dépôt, puis indiquer le chemin `infra/deploy/render-preprod.yaml`.
4. **Valeurs secrètes**, demandées à la création :
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (et `SMTP_PORT`, 587 par défaut) et `MAIL_FROM` : un fournisseur d'e-mail transactionnel, car Render n'envoie pas d'e-mails. Pour Brevo : `smtp-relay.brevo.com`, l'identifiant SMTP tel quel (avec son `@`) et la clé SMTP. `SMTP_URL` reste acceptée, mais il faut y encoder les caractères spéciaux. Brevo, Scaleway TEM ou Postmark conviennent ; pour l'UE, préférer Brevo ou Scaleway TEM.
   - `APP_URL` : laisser vide pour utiliser l'adresse `onrender.com`, ou indiquer le domaine personnalisé.
5. **Crochets de déploiement.** Dans Render, ouvrir _Settings → Deploy Hook_ de chacun des deux services et copier l'URL.
6. **GitHub.** Aller dans _Settings → Environments_ et créer l'environnement **`preproduction`**, avec :
   - les secrets `RENDER_DEPLOY_HOOK_WEB` et `RENDER_DEPLOY_HOOK_WORKER` ;
   - la variable `PREPROD_URL` (par exemple `https://cr-preprod-web.onrender.com`).
7. Relancer le job `deploy-preprod`. Créer un compte sur la préproduction et vérifier que l'e-mail arrive : J0 est alors fini.

## État

Mis en place le 3 novembre 2026 : https://cr-preprod-web.onrender.com. Inscription, e-mail de vérification (Brevo) et connexion vérifiés ; le job `deploy-preprod` déploie et vérifie chaque push sur `main`.

**Synchronisation du Blueprint.** L'image fixée dans `render-preprod.yaml` ne sert qu'à la création des services : ensuite, c'est la CI qui choisit l'image (crochets de déploiement). Désactiver la synchronisation automatique du Blueprint dans Render (_Blueprints → le Blueprint → Settings_), sinon un push qui touche ce fichier pourrait redéployer l'image qui y est écrite. Synchroniser à la main quand on change l'infrastructure (plans, variables, services).

## Outils d'exploitation

Le chat, les messages privés, les demandes d'amis et les boutiques exigent une adresse e-mail vérifiée (variable `REQUIRE_VERIFIED_EMAIL`, vraie par défaut ; à mettre à `false` seulement si l'envoi d'e-mails tombe en panne). La modération exige aussi que le modérateur ait activé la double authentification depuis sa page Compte (variable `REQUIRE_STAFF_2FA`, vraie par défaut). Trois outils de l'image se lancent depuis le shell du service web (_Shell_ dans Render), dans `/app/web`, et journalisent leur action dans `admin_action` :

- `node dist/verify-email.js <e-mail>` : marque une adresse comme vérifiée (courriel perdu, comptes créés avant l'exigence).
- `node dist/grant-role.js <e-mail> <player|moderator|admin>` : nomme un modérateur ou un administrateur (il n'y a pas d'écran pour le premier). Il active ensuite la double authentification depuis sa page Compte.
- `node dist/reset-2fa.js <e-mail>` : retire la double authentification d'un compte qui a perdu son application, et ferme ses sessions.

En développement : `pnpm verify-email <e-mail>`, `pnpm grant-role <e-mail> <rôle>` et `pnpm reset-2fa <e-mail>`.

**IP des clients.** Render est derrière Cloudflare, qui ajoute à `X-Forwarded-For` au lieu de le remplacer : l'application lit l'IP du client dans `CF-Connecting-IP` (variable `CLIENT_IP_HEADER`, `cf-connecting-ip` par défaut), puis, à défaut, dans `X-Forwarded-For` avec `TRUST_PROXY_HOPS` sauts de confiance (1). Elle sert aux limites par IP et au garde-fou des connexions. À vérifier une fois : après une connexion en préproduction, `ip_prefix` de la session (table `session`) doit être le préfixe de votre adresse, pas celui d'un proxy.

**Mode maintenance.** `MAINTENANCE=true` sur le service web fait répondre une page d’attente (503, `Retry-After`) à toutes les routes du jeu ; `/health` répond toujours (et indique `maintenance: true`). À utiliser pour une opération exceptionnelle (restauration, correction de l’économie), puis remettre à `false`.

## À vérifier sur Render avant la production

C'est la grille de la section 18 du guide. Ces points sont à confirmer sur les offres du moment :

- **PITR** : rétention selon le plan de l'espace de travail. Il faut 7 jours ou plus en production, donc probablement l'espace _Professional_.
- **Haute disponibilité** de Postgres : réservée aux instances _Pro_ et plus.
- **Connexions SSE longues** : vérifier la durée maximale d'une requête derrière le répartiteur de Render avant J6. Au besoin, le client se reconnecte (`EventSource` le fait de lui-même).
- **Extensions** `pg_trgm` et `pg_stat_statements` (J5).
- La production aura son propre Blueprint (`render-prod.yaml`) : 2 exemplaires web, une base avec réplique et un déploiement sur approbation (guide 17.2, étape 9).
