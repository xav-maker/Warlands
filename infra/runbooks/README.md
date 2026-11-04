# Procédures d'exploitation

Les sept procédures du guide technique (section 19.5). Chacune dit quand l'appliquer, quoi faire dans l'ordre, et comment vérifier que c'est fini. Les outils cités sont ceux de l'image : ils se lancent depuis le shell du service web sur Render (_Shell_), dans `/app/web` ; en développement, par `pnpm <outil>`.

| #   | Procédure                                                    | Quand                                                               |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | [Incident](01-incident.md)                                   | site en panne, alerte haute ou critique, violation d'invariant      |
| 2   | [Restauration à un instant donné](02-restauration.md)        | données perdues ou corrompues ; test mensuel                        |
| 3   | [Retour arrière du code ou du contenu](03-retour-arriere.md) | déploiement fautif                                                  |
| 4   | [Correction d'un bien ou d'un solde](04-correction.md)       | joueur lésé par un bogue ou un incident                             |
| 5   | [Sanction et signalement](05-moderation.md)                  | signalement à traiter, comportement abusif                          |
| 6   | [Rotation d'un secret](06-secrets.md)                        | secret exposé, départ d'une personne, rotation annuelle             |
| 7   | [Demande RGPD](07-rgpd.md)                                   | demande d'accès, de portabilité ou de suppression reçue hors du jeu |

**Ce qui n'est pas encore en place** (jalon J8, à brancher avant la production) : l'outil d'erreurs et les tableaux de bord (guide 19.1 et 19.4), les alertes envoyées hors des journaux (19.2), la sauvegarde externe chiffrée et son test de restauration (18.5). Les procédures le signalent là où elles en dépendent.

## Outils de l'image

| Outil                                                         | Rôle                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `node dist/migrate.js`                                        | migrations (lancé avant chaque déploiement)                         |
| `node dist/grant-role.js <e-mail> <player\|moderator\|admin>` | nommer un modérateur ou un administrateur                           |
| `node dist/verify-email.js <e-mail>`                          | marquer une adresse comme vérifiée                                  |
| `node dist/reset-2fa.js <e-mail>`                             | retirer la double authentification d'un compte, fermer ses sessions |
| `node dist/correct.js gold\|item …`                           | corriger un solde ou des objets, par le grand livre (procédure 4)   |

Variables d'urgence du service web : `MAINTENANCE=true` (page d'attente partout sauf `/health`), `REQUIRE_VERIFIED_EMAIL=false` (si l'envoi d'e-mails est en panne).
