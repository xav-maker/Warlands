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
2. **Accès de Render à ghcr.io.** Créer sur GitHub un jeton _classic_ avec le seul droit `read:packages`. Dans Render, aller dans _Workspace Settings → Container Registry Credentials_ et ajouter un identifiant nommé **`ghcr`** (registre GitHub, utilisateur GitHub, ce jeton).
3. **Blueprint.** Dans `render-preprod.yaml`, remplacer `latest` par le SHA publié à l'étape 1. Dans Render, choisir _New → Blueprint_, prendre le dépôt, puis indiquer le chemin `infra/deploy/render-preprod.yaml`.
4. **Valeurs secrètes**, demandées à la création :
   - `SMTP_URL` et `MAIL_FROM` : un fournisseur d'e-mail transactionnel, car Render n'envoie pas d'e-mails. Brevo, Scaleway TEM ou Postmark conviennent ; pour l'UE, préférer Brevo ou Scaleway TEM.
   - `APP_URL` : laisser vide pour utiliser l'adresse `onrender.com`, ou indiquer le domaine personnalisé.
5. **Crochets de déploiement.** Dans Render, ouvrir _Settings → Deploy Hook_ de chacun des deux services et copier l'URL.
6. **GitHub.** Aller dans _Settings → Environments_ et créer l'environnement **`preproduction`**, avec :
   - les secrets `RENDER_DEPLOY_HOOK_WEB` et `RENDER_DEPLOY_HOOK_WORKER` ;
   - la variable `PREPROD_URL` (par exemple `https://cr-preprod-web.onrender.com`).
7. Relancer le job `deploy-preprod`. Créer un compte sur la préproduction et vérifier que l'e-mail arrive : J0 est alors fini.

## À vérifier sur Render avant la production

C'est la grille de la section 18 du guide. Ces points sont à confirmer sur les offres du moment :

- **PITR** : rétention selon le plan de l'espace de travail. Il faut 7 jours ou plus en production, donc probablement l'espace _Professional_.
- **Haute disponibilité** de Postgres : réservée aux instances _Pro_ et plus.
- **Connexions SSE longues** : vérifier la durée maximale d'une requête derrière le répartiteur de Render avant J6. Au besoin, le client se reconnecte (`EventSource` le fait de lui-même).
- **Extensions** `pg_trgm` et `pg_stat_statements` (J5).
- La production aura son propre Blueprint (`render-prod.yaml`) : 2 exemplaires web, une base avec réplique et un déploiement sur approbation (guide 17.2, étape 9).
