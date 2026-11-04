# 7. Demande RGPD

**Quand** : une personne demande l'accès à ses données, leur portabilité, leur rectification ou leur suppression (guide 14). Délai légal de réponse : un mois.

## Le joueur a accès à son compte

Tout se fait seul, depuis la page **Compte** :

- **Accès et portabilité** : « Télécharger mes données (JSON) » — compte, sessions, partie, or et écritures, troupes, objets, quêtes, annonces et achats, combats, chat, messages privés, amis, blocages, signalements faits, sanctions reçues, notifications.
- **Suppression** : mot de passe et mot de confirmation. L'adresse, le mot de passe, les messages, les liens sociaux et les sessions sont effacés, le pseudo est remplacé, la partie est remise à zéro. Restent, sans donnée personnelle : les lignes du grand livre et des mouvements de biens (intégrité de l'économie), l'historique des combats, et les décisions de modération (obligation DSA).

Lui indiquer ces deux boutons suffit.

## Le joueur n'a plus accès à son compte

1. **Vérifier l'identité** : la demande doit venir de l'adresse du compte (lui écrire à cette adresse et attendre sa réponse). Ne rien envoyer à une autre adresse.
2. **Accès** : il peut choisir un nouveau mot de passe (« Mot de passe oublié ? » sur la page de connexion, lien envoyé à l'adresse du compte) ; à défaut, produire l'export pour lui depuis un shell, avec la fonction `exportData` du paquet `@cr/domain` (la même que la page Compte), et le lui envoyer chiffré ou en lien temporaire.
3. **Suppression** : il n'y a pas encore d'outil d'exploitation pour supprimer un compte sans son mot de passe. En attendant, lui faire choisir un nouveau mot de passe (« Mot de passe oublié ? ») et utiliser la page Compte. Un outil dédié est à écrire avant la production si ces demandes arrivent.

## Conservation

Chat 7 jours, messages privés 90 jours, journaux de combat complets 30 jours (purges du worker) ; sessions jusqu'à leur expiration ; échecs de connexion 1 jour.

Noter chaque demande traitée ici (sans donnée personnelle au-delà d'une référence) :

| Date de la demande | Type | Réponse le | Par |
| ------------------ | ---- | ---------- | --- |
|                    |      |            |     |
