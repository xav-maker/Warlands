# 2. Restauration à un instant donné

**Quand** : des données sont perdues ou corrompues en masse (migration fautive, suppression, bogue qui a abîmé l'économie) ; et chaque mois, en préproduction, pour vérifier que la restauration marche (guide 18.5 : une sauvegarde jamais restaurée ne compte pas).

Objectifs [H] : perte de données maximale de 5 minutes (PITR), remise en service en moins de 2 heures.

## Avant de restaurer

1. `MAINTENANCE=true` sur le service web (procédure 1) : plus aucune écriture.
2. Choisir l'instant : juste avant l'incident (journaux, `admin_action`, horodatage du déploiement fautif). En cas de doute, plus tôt.
3. Prévenir les joueurs : ce qui s'est passé entre cet instant et maintenant sera perdu.

## Restaurer (Postgres géré de Render)

1. Render › la base › _Recovery_ : restaurer **vers une nouvelle base** à l'instant choisi (ne jamais écraser la base en place : on garde l'état abîmé pour l'enquête).
2. Vérifier la nouvelle base, depuis un shell avec son URL :
   - les migrations sont à jour : `DATABASE_URL=<nouvelle> node dist/migrate.js` ne doit rien appliquer d'imprévu ;
   - les invariants : lancer le worker contre la nouvelle base, ou attendre sa passe de 10 minutes ; aucune ligne `alert: invariant`.
3. Pointer le web et le worker sur la nouvelle base (`DATABASE_URL`), redéployer.
4. `MAINTENANCE=false`, `/health`, parcours rapide.

## Sauvegarde externe (à mettre en place, guide 18.5)

En plus de la PITR de Render : un `pg_dump` chiffré chaque nuit vers un stockage objet chez un autre fournisseur, gardé 30 jours, et une copie mensuelle gardée 12 mois. Le fournisseur, le chiffrement (age ou GPG) et la tâche planifiée restent à choisir et à décrire ici. Restaurer depuis cette sauvegarde : déchiffrer, `pg_restore` dans une base neuve, puis les étapes 2 à 4.

## Test mensuel

Restaurer la production d'hier dans une base de préproduction, lancer les contrôles d'invariants, **chronométrer** chaque étape, noter la durée totale ici :

| Date | Source | Durée | Invariants | Par |
| ---- | ------ | ----- | ---------- | --- |
|      |        |       |            |     |
