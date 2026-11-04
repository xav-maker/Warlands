# 3. Retour arrière du code ou du contenu

**Quand** : un déploiement casse le jeu (erreurs, parcours bloqué, comportement inattendu).

## Le code

Les images sont étiquetées par le SHA du commit, et les migrations sont toujours compatibles avec la version précédente du code (guide 17.4) : on peut redéployer l'image d'avant sans toucher à la base.

1. Retrouver le SHA précédent : `git log --oneline` sur `main`, ou l'historique des déploiements dans Render.
2. Render › le service web › _Manual Deploy_ › _Deploy an existing image_ : l'image `…:<sha précédent>`. Faire de même pour le worker.
3. Vérifier `/health` : `version` doit être le SHA visé.
4. Corriger sur `main` (commit de retour ou correctif) ; le pipeline redéploiera.

Une migration ne se défait pas en production : si elle est en cause, écrire une migration suivante qui répare (méthode « élargir puis réduire »). Les fonctions `down` ne servent qu'en développement.

## Le contenu

Le contenu actif est compilé depuis `content/` dans l'image (`/health` › `content` donne son empreinte). Revenir au contenu précédent, c'est redéployer l'image précédente (ci-dessus), ou annuler le commit de contenu sur `main`.

Avant de publier un changement de contenu : `pnpm content validate`, `pnpm content simulate` (équilibrage des routes et des donjons) et `pnpm content diff <ancien>` (ce qui change).
