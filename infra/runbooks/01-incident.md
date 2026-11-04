# 1. Incident

**Quand** : le site ne répond plus, une alerte haute ou critique tombe (guide 19.2), un joueur signale une perte de biens, ou le worker journalise une violation d'invariant (`alert: invariant`, niveau `fatal`).

## 1. Qualifier (10 minutes au plus)

- `GET /health` : `ok`, version déployée (`version`), pack de contenu (`content`), `maintenance`.
- Journaux du service web et du worker sur Render (filtrer `level >= 50`, ou `alert`).
- Gravité :
  - **critique** : l'économie est menacée (violation d'invariant sur l'or ou les biens, duplication, achats incohérents) ;
  - **haute** : site injoignable, erreurs 5xx au-delà de 2 % ;
  - **moyenne** : lenteurs, file du worker en retard, une fonction en panne (e-mail, chat).

## 2. Contenir

- **Critique** : mettre `MAINTENANCE=true` sur le service web (Render › Environment), et redéployer. Plus aucune commande n'est acceptée ; `/health` répond toujours. Noter l'heure : elle sert à la restauration éventuelle (procédure 2).
- **Haute** : si le dernier déploiement est en cause, retour arrière (procédure 3) avant de chercher plus loin.
- E-mails en panne : `REQUIRE_VERIFIED_EMAIL=false` le temps de la panne (le chat et les boutiques restent ouverts).

## 3. Communiquer

Un message court sur le canal des joueurs : ce qui ne marche pas, depuis quand, et que leur partie est en sécurité. Mettre à jour au moins toutes les heures.

## 4. Corriger

- Bogue de code : correctif, revue, tests, déploiement (le pipeline habituel ; pas de modification directe en production).
- Données : jamais d'`UPDATE` à la main. Une restauration (procédure 2) si des données sont perdues en masse ; une correction tracée (procédure 4) pour quelques joueurs.
- Violation d'invariant : relancer les contrôles après la correction (le worker les lance toutes les 10 minutes ; vérifier que la violation ne revient pas).

## 5. Rouvrir et clore

- `MAINTENANCE=false`, redéployer, vérifier `/health` et un parcours rapide (connexion, ville, un combat).
- **Post-mortem** dans les 5 jours ouvrés : chronologie, cause, ce qui a marché, ce qui a manqué, actions (avec un responsable et une date). Sans recherche de coupable.
