# 6. Rotation d'un secret

**Quand** : un secret a pu être exposé (dépôt, journal, poste perdu), une personne qui y avait accès part, ou une fois par an.

Les secrets vivent dans les variables d'environnement des services Render, jamais dans le dépôt (gitleaks tourne en CI). Les sessions des joueurs ne reposent sur aucun secret serveur : leur jeton est aléatoire et seul son hash est en base.

| Secret                                 | Où                      | Rotation                                                                                                                                                            |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` (mot de passe Postgres) | web, worker, migrations | Render › la base : nouveau mot de passe ; mettre à jour la variable des services ; redéployer web et worker ; vérifier `/health`                                    |
| `SMTP_USER` / `SMTP_PASS` (Brevo)      | web                     | Brevo : nouvelle clé SMTP ; mettre à jour, redéployer ; s'inscrire avec une adresse de test et vérifier la réception ; supprimer l'ancienne clé                     |
| Crochets de déploiement Render         | secrets GitHub du dépôt | Render : régénérer ; mettre à jour le secret GitHub ; relancer le job de déploiement                                                                                |
| Compte administrateur compromis        | base                    | `node dist/reset-2fa.js <e-mail>` (ferme ses sessions), changer son mot de passe, rétrograder si besoin (`grant-role … player`), relire le journal d'administration |

Après une rotation : noter la date ici, et vérifier dans les journaux qu'aucune erreur d'authentification ne persiste.

| Date | Secret | Raison | Par |
| ---- | ------ | ------ | --- |
|      |        |        |     |
