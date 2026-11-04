# 5. Sanction et traitement d'un signalement

**Quand** : la file des signalements n'est pas vide, ou un comportement abusif est constaté.

Prérequis : un compte modérateur ou administrateur (`node dist/grant-role.js`), avec la double authentification activée depuis sa page Compte (la modération l'exige).

## Traiter un signalement

1. Page **Modération** : la file des signalements ouverts, du plus ancien au plus récent.
2. Ouvrir le signalement : le contenu signalé est copié (il reste lisible même supprimé), avec le dossier du joueur visé (sanctions passées, derniers messages, signalements reçus, mots masqués par le filtre).
3. Décider, et **motiver** (la décision est communiquée à l'auteur du signalement et au joueur sanctionné, DSA) :
   - classer sans suite ;
   - supprimer le message du chat ;
   - sanctionner : sourdine, interdiction de boutique (30 jours au plus pour un modérateur), suspension (7 jours au plus), bannissement (administrateurs) ;
   - remplacer un pseudo injurieux ou trompeur (le joueur en choisit un nouveau, une fois).
4. Tout est journalisé (page **Journal d'administration**).

## Contenu manifestement illicite

Supprimer tout de suite, sanctionner, et conserver la copie du signalement. Selon la nature du contenu, un signalement aux autorités peut être obligatoire : voir avec la personne responsable du service.

## Lever une sanction

Depuis le dossier du joueur, **Lever** ; un bannissement ne se lève que par un administrateur. Un compte suspendu redevient actif au terme de sa suspension (worker, chaque minute).
