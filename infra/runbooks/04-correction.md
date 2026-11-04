# 4. Correction d'un bien ou d'un solde

**Quand** : un joueur a perdu de l'or ou des objets à cause d'un bogue ou d'un incident, ou en a gagné indûment (duplication).

**Règle** : toujours par l'outil de correction, jamais par un `UPDATE` à la main (guide 19.5). L'outil passe par le grand livre (comptes `SOURCE_ADMIN` et `SINK_ADMIN`) ou par l'inventaire (`asset_move`), et journalise chaque correction dans `admin_action` avec son motif.

## Établir les faits

- Ce que le joueur avait et a maintenant : écritures de `gold_entry` de son compte, mouvements `asset_move` de ses biens, combats (`battle_participant`), annonces et ventes (`shop_listing`, `shop_sale`).
- L'export de ses données (page Compte, ou la requête de la procédure 7) donne une vue complète.
- Noter la référence de l'incident : elle va dans le motif.

## Corriger

Depuis le shell du service web, dans `/app/web` :

```sh
node dist/correct.js gold <e-mail> 150 "achat perdu, incident 2026-11-12"     # rend 150 or
node dist/correct.js gold <e-mail> -300 "duplication, incident 2026-11-12"     # retire 300 or (jamais sous zéro)
node dist/correct.js item <e-mail> fer_noir 5 "butin perdu, incident 2026-11-12"   # 5 objets en banque (même pleine)
node dist/correct.js item <e-mail> fer_noir -5 "duplication, incident 2026-11-12"  # retire 5 objets de la banque
```

Le motif fait au moins 5 caractères. L'outil refuse un retrait plus grand que ce que le joueur possède.

Pas encore couvert par l'outil : les exemplaires d'équipement et les troupes. En attendant, une correction de ce genre se fait par un correctif de code relu (une commande d'administration dédiée), jamais en base à la main.

## Vérifier

- Le joueur voit le résultat (or, banque).
- `admin_action` contient la ligne `correction.gold` ou `correction.item`.
- La passe d'invariants suivante du worker ne signale rien.
- Prévenir le joueur, avec le motif.
