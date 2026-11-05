# Les Cinq Régions : description exacte du jeu actuel

**Objet.** La partie I de ce document décrit le jeu tel qu'il fonctionne aujourd'hui dans le prototype « Les Cinq Régions » (version 4.5, 3 novembre 2026), pour servir de spécification à la version multijoueur en ligne. Il ne propose pas encore l'architecture multijoueur : il dit ce que fait le jeu, avec ses règles, ses formules et ses chiffres, et il signale ce qui tourne aujourd'hui dans le navigateur et devra passer côté serveur.

**Partie II** (à partir de la section 17) : le jeu multijoueur que Xavier veut construire, avec ce qui change par rapport à la partie I.

**Source de vérité.** Le code de `/mnt/project-files/prototype-ville/src/` (moteur `proto-0.4-ville`, sauvegarde version 2). Quand ce document et les specs plus anciennes (`cadrage/`, `combat/`, `objets/`, `architecture/`) diffèrent, c'est le code qui fait foi ; les écarts sont listés en section 14.

**Fichiers.**
- Ce README : les systèmes, les formules, les valeurs, l'état sauvegardé, le passage au serveur.
- [annexe-contenu.md](/mnt/project-files/multijoueur/annexe-contenu.md) : tout le contenu, généré depuis le code (92 capacités, 40 troupes recrutables, 77 monstres dont 5 gardiens et 20 rares, 75 bases d'équipement, 75 objets non équipables, 36 armes naturelles, 25 étapes, stratégies par défaut de chaque type).
- Prototype jouable : https://claude.ai/artifact/7UXBHcKTEtXNLznB1GwTRc

**Conventions.**
- Tous les calculs du moteur sont en entiers. Un pourcentage noté « ‰ » est en millièmes (1 000 = 100 %). Les arrondis sont des arrondis à l'entier inférieur (`floor`) sauf mention contraire.
- « Instant » : unité de temps du combat.
- **[H]** : valeur d'hypothèse, réglable à l'équilibrage, jamais validée comme définitive.
- **[Xavier]** : réglage demandé explicitement par Xavier (surtout le 3 novembre 2026). À ne pas changer sans lui.

---

## Sommaire

1. Le jeu en une page
2. Organisation actuelle du code
3. Monde : régions, villes, territoires, déplacements
4. Troupes : types, statistiques, niveaux, escouade
5. Combat : le moteur
6. Rencontres et monstres
7. Objets, stockage et équipement
8. Économie : or, marchand, recrutement, atelier, recettes personnelles, butin
9. Monstres rares et quêtes
10. Interface et déroulé d'une partie
11. État de la partie et sauvegarde
12. Aléa et graines
13. Ce qui est côté client et doit passer côté serveur
14. Écarts avec les specs, fonctions prévues mais absentes
15. Équilibrage mesuré
16. Bizarreries du code à trancher avant de réécrire

---

## 1. Le jeu en une page

Un joueur dirige une escouade de troupes (5 points de population, 5 emplacements d'unité au plus) qui combat automatiquement des groupes de monstres. Il ne joue pas les combats : il prépare la composition, le rang de chaque troupe, l'équipement de chaque unité et une stratégie de règles « si / alors » par troupe, puis il regarde le combat se dérouler.

La boucle est la suivante :

1. **En ville** : soigner gratuitement au temple, recruter des troupes (or et matériaux selon des recettes personnelles), fabriquer équipement et consommables à l'atelier, acheter et vendre au marchand, ranger dans la banque (commune à toutes les villes), rendre des quêtes, choisir l'escouade.
2. **En expédition** : traverser un territoire de 5 étapes de difficulté croissante, gardien à la dernière. Les PV ne remontent pas entre deux combats, le mana regagne 25 % à la fin de chaque combat, seuls les consommables du sac soignent. Le butin va dans un sac de 20 emplacements.
3. **Combat** : simulé instantanément par un moteur déterministe, puis rejoué en pixel art. La rediffusion ne se passe pas : il faut la regarder jusqu'au bout (accélérable jusqu'à ×4) avant de continuer.
4. **Conséquences** : une unité tombée à 0 PV est morte définitivement, avec son équipement. Les survivants gagnent de l'XP. Une défaite renvoie de force en ville (le sac est gardé).
5. **Progression** : 5 régions de niveau 1 à 27+. Pour atteindre la ville suivante, il faut traverser tout le territoire qui y mène et vaincre son gardien.

Il n'y a aujourd'hui **aucune interaction entre joueurs** : pas de marché, pas d'échange, pas de PvP. Mais le jeu est construit pour l'échange : chaque joueur a des recettes différentes, donc des matériaux inutiles pour lui et utiles à d'autres (section 8.5).

---

## 2. Organisation actuelle du code

Tout tourne dans une seule page HTML autonome, sans serveur. La partie est sauvegardée dans le `localStorage` du navigateur après chaque action.

| Fichier | Rôle | Futur emplacement |
|---|---|---|
| `engine.ts` | Moteur de combat pur : `simuler(entrée, graine) → { résultat, journal }`. PRNG xoshiro128**. Aucune I/O. | Paquet moteur partagé serveur et client (le client ne s'en sert que pour typer le journal). |
| `content.ts` | 10 troupes et 59 capacités du banc d'essai, armes de base, paramètres du moteur, calcul des stats (`computeStats`), apprentissage des capacités. | Contenu versionné + module Combat. |
| `sorts.ts` | 33 capacités décrites par des données (`fx`). | Contenu. |
| `unites.ts` | 30 troupes recrutables ajoutées, 8 armes. | Contenu. |
| `bestiaire.ts` | 50 monstres ajoutés (dont 4 gardiens), 12 armes. | Contenu. |
| `ia.ts` | Générateur de la stratégie par défaut d'un type à partir de ses capacités. | Outil de contenu (à la compilation du pack). |
| `monde.ts` | Objets, bases d'équipement, emplacements par type, 7 monstres d'origine, régions, étapes, constantes d'économie `ECO`. | Contenu + configuration. |
| `gen.ts` | Générateurs déterministes : exemplaires d'équipement, recettes personnelles, groupes de monstres, butin, hachage. | Serveur uniquement. |
| `quetes.ts` | 20 monstres rares, générateur de quêtes. | Contenu + serveur. |
| `jeu.ts` | État de la partie (`Game`) et toutes les commandes du joueur (recruter, fabriquer, partir, combattre…). Chaque commande vérifie ses conditions et lève une erreur lisible. | **Serveur** : c'est la couche « domaine ». |
| `strategie.ts` | Éditeur de stratégie (interface). | Client. |
| `app.ts`, `codex.ts`, `replay.ts`, `pixel.ts`, `dom.ts`, `page.html` | Interface : onglets, codex, rediffusion tableau et pixel art. | Client. |
| `test.ts` | Tests de cohérence, déterminisme, matrices de victoires, parties jouées par un bot. | Tests serveur. |

Le banc d'essai du combat (`/mnt/project-files/prototype-combat/`) est un outil séparé qui sert à régler le moteur. Son moteur (`proto-0.4`) **ne connaît pas** les effets `fx`, les 4 nouveaux états, les recharges de soins ni les tics rapides : la copie de la ville a divergé. La version multijoueur doit partir du moteur de `prototype-ville`.

Reconstruire : `npm i -D typescript esbuild`, `node build.mjs` (produit `dist/ville-territoire.html`). Tests : `npx esbuild src/test.ts --bundle --platform=node --outfile=build/test.js && node build/test.js [0-4|mon|bots|rare]`.

---

## 3. Monde : régions, villes, territoires, déplacements

### 3.1 Les 5 régions

Chaque région a une ville et un territoire de 5 étapes. Le palier de la région fixe le palier de l'équipement, des matériaux et de l'or.

| # | Région | Ville | Territoire | Palier | Niveau min. | Niveaux des monstres (étapes 1 → gardien) | Gardien |
|---|---|---|---|---|---|---|---|
| 1 | Pays de Havre-Gris | Havre-Gris | Forêt des Ronces | 1 | 1 | 3-4 → 8-9 | Sylvain des Ronces |
| 2 | Côte de Port-Salant | Port-Salant | Marais des Noyés | 2 | 6 | 8-9 → 13-14 | Mère des Noyés |
| 3 | Monts de Rochecreuse | Rochecreuse | Mines de Fer-Hurlant | 3 | 11 | 13-14 → 18-19 | Cœur-de-Forge |
| 4 | Terres de Cendrelune | Cendrelune | Désert de Cendre | 4 | 16 | 18-19 → 23-24 | Dragon de cendre |
| 5 | Hauteurs de l'Aube | Sanctuaire de l'Aube | Ruines Célestes | 5 | 21 | 23-24 → 28-29 | Archonte déchu |

Le détail de chaque étape (pool de monstres, population, butin, or, matériaux, monstre rare) est dans l'annexe, section H.

### 3.2 Les étapes d'un territoire

Pour une région de niveau minimal `L` et de palier `T`, l'étape `i` (0 à 4) a :

| Étape | Niveaux des monstres | Population du groupe | Tirages de butin | Or de base |
|---|---|---|---|---|
| 1 (i = 0) | L+0+2 à L+1+2 | `firstPop` (par région) | 1-2 | 8 × T² |
| 2 | L+1+2 à L+2+2 | [max de firstPop, max + 1] | 1-2 | 12 × T² |
| 3 | L+2+2 à L+3+2 | 3-5 | 2 | 16 × T² |
| 4 | L+3+2 à L+4+2 | 5-7 | 2 | 22 × T² |
| 5 (gardien) | L+5+2 à L+6+2 | `guardianPop` | 2-3 + 1 garanti | 40 × T² |

Exception au palier 1 [Xavier, 5 novembre 2026] : les étapes 1 à 3 sont aux niveaux 1-2, 3-4 et 4-6 (l’étape 4 et le gardien ne changent pas), pour que les premières troupes, de niveau 1, rencontrent des monstres de leur niveau. Le « +2 » est `MONSTER_LEVEL_BONUS` [Xavier]. `firstPop` vaut [1,2] (région 1), [2,3] (régions 2 et 3), [3,4] (régions 4 et 5). `guardianPop` vaut [8,9] (régions 1 et 3), [6,7] (région 2), [9,10] (région 4), [7,7] (région 5). Le gardien est **imposé** dans le groupe de la 5e étape ; le reste du budget est complété par des monstres du pool de l'étape (section 6.1).

### 3.3 Déplacements [Xavier, 3 novembre 2026]

- Le territoire `i` relie la ville `i` à la ville `i+1`. Le territoire 5 (Ruines Célestes) est un cul-de-sac.
- **Il n'y a pas de voyage direct.** Pour arriver dans une ville, il faut traverser le territoire qui y mène et vaincre sa dernière étape.
- Depuis la ville `r`, deux départs possibles :
  - **vers l'avant** (`dir = 1`) : territoire `r`, arrivée à la ville `r+1` (ou cul-de-sac pour r = 5) ;
  - **à rebours** (`dir = −1`, si r > 1) : territoire `r−1`, arrivée à la ville `r−1`.
- **Dans les deux sens, les étapes se font dans le même ordre**, de 1 à 5, gardien au bout. Revenir en arrière impose donc aussi de battre le gardien du territoire.
- On peut **rentrer à la ville de départ à tout moment** (hors rediffusion en cours), sans combat.
- On ne peut **avancer** à l'étape suivante que si l'étape courante est dégagée (une victoire). On peut **rebrousser** d'une étape (l'étape reste dégagée et une nouvelle rencontre est tirée) et **chercher un nouveau combat** sur place pour récolter.
- **Arriver** n'est possible qu'à la dernière étape, une fois dégagée. L'arrivée change la région du joueur et efface le butin laissé au sol.
- Chaque départ remet toutes les étapes à « non dégagée ». Rien n'est débloqué définitivement : retraverser un territoire demande de le refaire en entier.
- `unlocked` (ville la plus lointaine atteinte) et `guardians[]` (gardien déjà vaincu) sont mémorisés, mais ne servent qu'à l'affichage et à l'objet de première victoire (section 8.6). Ils ne donnent aucun raccourci.

### 3.4 Services d'une ville

Toutes les villes offrent les mêmes services, avec un contenu propre :
- **Temple** : soins gratuits et illimités, PV et mana au maximum pour toutes les troupes du joueur (escouade et caserne).
- **Caserne** : recrutement des 8 types de la ville, rachat des unités manquantes des types de la ville.
- **Atelier** : toutes les recettes du joueur, sauf l'équipement de palier 4 (seulement à Cendrelune) et de palier 5 (seulement au Sanctuaire de l'Aube).
- **Marchand** : vend l'équipement du palier de la région (5 catégories) et des consommables ; rachète tout.
- **Banque** : commune à toutes les villes, 100 emplacements.
- **Tableau des quêtes** : 5 quêtes propres à la ville.
- **Prêt de la garde** : si le joueur n'a plus aucune troupe (ni en escouade ni en caserne), la garde lui prête gratuitement un Milicien de niveau 1 [H]. C'est un filet de sécurité contre le blocage.

---

## 4. Troupes : types, statistiques, niveaux, escouade

### 4.1 Types de troupes

Un **type** (ex. Milicien, Frondeurs) définit : nombre d'unités (1 à 3), coût en population (1 à 3 pour les recrutables, jusqu'à 6 pour un gardien), étiquettes (humain, bête, mort-vivant, céleste…), rôle, arme naturelle, rang de départ par défaut, stats de base et croissance par niveau, vitesse, résistances, capacités avec leur niveau d'apprentissage, emplacements d'équipement acceptés, stratégie par défaut.

- **40 types recrutables**, 8 par ville (annexe, section C). Les 10 du banc d'essai (Milicien, Frondeurs, Acolyte, Apprenti pyromancien, Chasseur, Berserker, Loups jumeaux, Adepte des ombres, Novice du monastère, Briseur) sont répartis dans les villes 1 à 3 ; les 30 nouveaux dans les 5 villes.
- Une **troupe** est un exemplaire possédé : type, niveau, XP, forme, liste de ses unités vivantes, rang, engagée ou non, stratégie personnalisée éventuelle.
- Une **unité** est un combattant : PV courants, mana courant, équipement propre (3 emplacements).

### 4.2 Statistiques d'une unité

Statistiques de base au niveau `n` (`computeStats`), pour chaque stat `k` :

```
g(k) = base[k] + floor(croissance[k] × (n − 1))
PV max     = floor(g(hp) × multPV_forme / 1000) × GAUGE_MULT
Volonté max = g(will) + bonus_forme
Énergie max = (g(energy) + bonus_forme) × GAUGE_MULT
Mana max    = (g(mana) + bonus_forme) × GAUGE_MULT, ou 0 si base et croissance de mana valent 0
Attaque     = g(atk) + bonus_forme
Vitesse     = vitesse de la forme (fixe, plus petit = plus rapide)
Résistances = % de la forme × 10 (en ‰)
```

`GAUGE_MULT = 3` [Xavier] : PV, énergie et mana triplés pour toutes les troupes et tous les monstres (combats environ 2,5 fois plus longs). La volonté et l'attaque ne sont pas multipliées. Dans le prototype ville, une troupe reste toujours dans sa première forme (pas d'évolution), donc `multPV_forme = 1000` et les bonus de forme sont nuls.

Exemple : un Milicien niveau 1 a 300 PV, 60 de volonté, 300 d'énergie, 0 mana, 5 d'attaque, vitesse 20, 10 % de résistance tranchante, arme Épée courte (12 tranchant, vitesse 20, coût 10).

Les **stats finales** ajoutent l'équipement (section 7.4).

### 4.3 Capacités apprises et actives

- Une troupe apprend automatiquement les capacités de sa forme dont le niveau d'apprentissage est ≤ à son niveau.
- **Attaque de base** : la première capacité de la forme de départ (Emploi d'arme, Tir de fronde, Tir à l'arc, Morsure…). Elle ne coûte pas de mana, elle est **toujours active** et ne peut pas être désactivée.
- **6 capacités actives au plus**, passifs compris, actions communes exclues (Avancer, Reculer, Attendre, Fuir).
- **Par défaut** : si la troupe connaît 6 capacités ou moins, toutes sont actives ; sinon l'attaque de base + les 5 plus récemment apprises.
- Le joueur peut choisir lui-même ses capacités actives (section 4.7).

### 4.4 Niveaux et expérience [H]

- Niveaux 1 à 30 (`maxLevel`).
- XP pour passer du niveau `n` à `n+1` : `round(50 × n × (1 + n/10))`. Exemples : niv. 1 → 55, niv. 5 → 375, niv. 10 → 1 000, niv. 20 → 3 000, niv. 29 → 5 655. L'XP restante est reportée.
- XP d'une victoire : `base = Σ (niveau × population) des troupes de monstres × 8`.
- **Chaque troupe gagnante reçoit la totalité de `base`** (l'XP n'est pas partagée), réduite si elle est trop forte : avec `écart = niveau_troupe − floor(niveau moyen des troupes de monstres) − 2`, la troupe reçoit `base` si écart ≤ 0, sinon `floor(base / 2^écart)`.
- Une troupe gagne de l'XP si au moins une de ses unités a fini le combat vivante et **sans avoir fui**. Défaite : aucune XP.
- Au passage de niveau, les PV et le mana courants augmentent du gain de maximum (puis sont bornés).

### 4.5 Population, escouade, rang

- **Escouade** : les troupes engagées. Contraintes : population totale ≤ 5 et nombre d'unités ≤ 5. Une troupe de 3 unités prend 3 emplacements.
- Les troupes non engagées restent **en caserne**, sans limite de nombre et sans coût. Elles ne vont pas en expédition.
- Engager ou retirer une troupe n'est possible **qu'en ville**. Une recrue (ou une troupe de récompense) rejoint l'escouade automatiquement s'il reste de la place, sinon elle va en caserne.
- **Rang** (1 = contact, 2, 3 = arrière) : choisi par troupe ; toutes ses unités démarrent au même rang. Modifiable partout, y compris en expédition entre deux combats. Valeur initiale : le rang par défaut du type.

### 4.6 Mort, rachat, prêt

- Une unité tombée à 0 PV est **morte définitivement**. Son équipement est **détruit**.
- Une troupe sans unité vivante disparaît.
- Une troupe qui a perdu des unités peut **racheter** les unités manquantes, **seulement dans sa ville de recrutement** (cadrage D9), sans perte de niveau. Coût = recette de recrutement du joueur × (unités manquantes ÷ unités du type), chaque quantité arrondie au supérieur, or compris. Les unités rachetées arrivent à pleine vie, sans équipement. Il faut assez d'emplacements libres si la troupe est engagée.
- Les survivants d'un combat gardent au moins 1 PV.

### 4.7 Stratégie personnalisée

> Jeu en ligne : remplacé par la section 20.1 (pas d'éditeur de règles, capacités désactivables).

Chaque troupe peut avoir une stratégie personnalisée (`strat`), qui s'applique à toutes ses unités :
- capacités actives (6 au plus, attaque de base toujours incluse, uniquement parmi les capacités connues) ;
- liste ordonnée de règles `{ condition, valeur?, état?, action, cible }` (vocabulaire en section 5.6), sans limite de nombre.

Sans stratégie personnalisée, la troupe utilise la stratégie par défaut de son type, privée des règles qui utilisent une capacité pas encore apprise. La première modification copie le défaut ; « Revenir à la stratégie par défaut » supprime le choix. Une règle dont l'action n'est pas active est conservée mais ignorée au combat. Modifiable en ville et en expédition, entre deux combats.

---

## 5. Combat : le moteur

### 5.1 Contrat

`simuler(entrée, graine) → { résultat, journal }`, pur et déterministe : même entrée et même graine donnent toujours le même journal. L'entrée contient, pour chaque unité : id (`A1`… pour le joueur, `B1`… pour les monstres), camp, emplacement, troupe d'origine, nom, étiquettes, maximums des 4 jauges, attaque, vitesse, résistances (‰ par type), arme (type, dégâts, vitesse, coût), PV et mana courants, rang de départ, capacités actives, règles. Plus les paramètres et le dictionnaire des capacités.

Le résultat donne le vainqueur (`0` joueur, `1` monstres, `null` égalité impossible en pratique), la raison (`wipe` ou `timeout`), l'instant de fin et, par unité : PV, mana, mort, fuite, dégâts infligés, ennemis tués.

### 5.2 Paramètres actuels

| Paramètre | Valeur | Effet |
|---|---|---|
| `timeLimit` | 3 000 | Au-delà, le combat s'arrête et **les monstres gagnent** (défaite du joueur). |
| `tick` | 20 | Période des tics généraux (Aura de sérénité, remise à zéro des attaquants pour l'Instinct de meute). |
| `dotTick` | 4 | Période des tics de dégâts et soins sur la durée [Xavier]. |
| `waitRegen` | 50 ‰ | Énergie rendue par Attendre (5 % du max). |
| `waitManaRegen` | 50 ‰ | Mana rendu par Attendre (5 % du max) [Xavier]. |
| `woundWill` | 500 | Volonté perdue en ‰ par ‰ de PV perdus (−1 % par 2 %). |
| `allyDeathWill` | 100 ‰ | Volonté perdue à la mort d'un allié d'une autre troupe. |
| `sameTroopDeathWill` | 200 ‰ | Volonté perdue à la mort d'un allié de la même troupe. |
| `killWill` | 100 ‰ | Volonté gagnée en tuant un ennemi. |
| `hasteMod` / `slowMod` | 750 / 1 250 | Durée des actions ×0,75 sous Hâte, ×1,25 sous Ralenti (s'annulent si les deux). |
| `resCap` / `resFloor` | 750 / −1 000 | Résistance bornée entre −100 % et +75 %. |
| `moveMult` | 1 000 | Durée d'Avancer, Reculer, Attendre = vitesse de l'unité × 1. |
| `fleeMult` | 2 000 | Durée de Fuir = vitesse × 2. |
| `manaSkipsRule` | 1 | Une règle dont le sort coûte plus de mana qu'il n'en reste est sautée. |
| `stallTime` | 100 | Combat considéré bloqué si personne n'a perdu de PV depuis 100 instants. |
| `healMult` | 1 200 | Tous les soins en combat ×1,2 [Xavier]. |
| `healCooldown` | 60 | Recharge par cible des soins directs [Xavier]. |
| `hotCooldown` | 100 | Recharge par cible des Régénérations [Xavier]. |

### 5.3 Temps et ordre d'action

- Chaque unité a un instant de prochaine action `nextAt`, initialisé à `max(1, vitesse)`.
- Le moteur avance à l'événement le plus proche parmi : prochain tic général (multiple de 20), prochain tic rapide (multiple de 4), prochaine action. À instant égal : tic rapide d'abord, puis tic général, puis les actions.
- À chaque instant, les états expirés (fin ≤ maintenant) sont retirés d'abord.
- Ordre des unités à instant égal : `nextAt`, puis vitesse (plus petite d'abord), puis camp (joueur d'abord), puis emplacement.
- Une action dure `durée = base × multiplicateur / 1000` instants, où `base` est la vitesse de l'unité ou celle de son arme selon la capacité, puis modifiée par Hâte/Ralenti, au moins 1. L'unité rejoue à `maintenant + durée + retard` (retard = étourdissements reçus pendant sa propre action).

### 5.4 Positions et portées

- Chaque unité est à un rang physique 1, 2 ou 3.
- **Rang effectif** : rang parmi les rangs occupés de son camp (un camp dont seuls les rangs 2 et 3 sont occupés les voit compter comme 1 et 2) [Xavier].
- Distance entre deux ennemis = rang effectif A + rang effectif B − 1. Le contact est une distance de 1.
- Distance entre deux alliés = |rang effectif A − rang effectif B|.
- Une capacité ennemie touche les cibles à distance ≤ portée et ≥ portée minimale (Charge : 2 à 4).
- **Avancer** rejoint le rang occupé le plus proche devant soi (gagne un rang effectif) ; possible si rang effectif > 1. **Reculer** : rang physique +1, possible si < 3. **Fuir** : seulement au rang physique 3 ; l'unité quitte le combat et survit, sans XP.

### 5.5 Déroulé d'une action

1. Énergie et mana mis de côté par un Attendre précédent sont crédités.
2. Si l'unité est **Gelée**, elle ne fait rien et rejoue à la fin du gel.
3. Si le combat est **bloqué** (personne n'a perdu de PV depuis 100 instants, ou aucune unité ne peut toucher un ennemi avec une attaque active qu'elle peut payer en mana) et que l'unité n'est pas au rang effectif 1, elle **avance automatiquement** au lieu d'appliquer sa stratégie [Xavier].
4. Sinon, elle choisit la **première règle applicable** (5.6). Aucune règle : elle attend.
5. Si l'énergie ou le mana ne suffisent pas au moment d'agir, elle **attend** (raison « énergie »).
6. Test de **volonté** (sauf actions communes) :
   - volonté ≥ 50 % : réussite ;
   - 20 % ≤ volonté < 50 % : 1 chance sur 2 de **demi-échec** ;
   - volonté < 20 % : 1 chance sur 2 d'**échec critique** ;
   - sous Confusion : demi-échec forcé, et la Confusion est retirée.
   Il n'y a pas de réussite critique.
7. Paiement : énergie = coût fixe + coût de l'arme × `energyW`/1000 ; mana = coût du sort.
8. Résolution de la capacité selon le résultat (5.9 et annexe B).

**Attendre** : met de côté 5 % de l'énergie max et 5 % du mana max (crédités à l'action suivante), dure vitesse × 1.

### 5.6 Règles si / alors (gambits)

À chaque action, l'unité parcourt ses règles dans l'ordre et prend la première qui remplit tout : action active (ou commune), pas un sort à mana sous Silence, condition vraie, au moins une cible valide, mana suffisant.

**Conditions** (valeur `v` en % sauf mention) :

| Condition | Vraie si |
|---|---|
| `always` | toujours |
| `selfHpBelow v` | mes PV < v % |
| `allyHpBelow v` | un allié (moi compris) a PV < v % |
| `selfWillBelow v` | ma volonté < v % |
| `selfEnergyBelow v` / `selfEnergyAbove v` | mon énergie < v % / ≥ v % |
| `selfManaBelow v` | j'ai du mana et mon mana < v % |
| `enemyInRange` / `noEnemyInRange` | un ennemi / aucun ennemi à la portée de ma première capacité offensive active |
| `myDist v` | mon rang effectif = v |
| `enemiesAtLeast v` | nombre d'ennemis en jeu ≥ v |
| `timeAtLeast v` | instant ≥ v |
| `selfHasState s` / `selfLacksState s` | j'ai / je n'ai pas l'état s |
| `targetHasState s` / `targetLacksState s` | filtre les cibles : celles qui ont / n'ont pas l'état s |

**Cibles** : `self`, `nearestEnemy` (distance, puis PV, puis emplacement), `weakestEnemy` (PV les plus bas), `strongestEnemy` (PV les plus hauts), `lowestWillEnemy` (volonté en % la plus basse), `randomEnemy` (tirage), `mostWoundedAlly` (PV en % les plus bas). Pour un sort sur allié, toute autre cible devient `mostWoundedAlly` ; pour un sort ennemi, `self` et `mostWoundedAlly` deviennent `nearestEnemy`.

**Provocation** : une capacité marquée « attaque » doit viser un ennemi sous Provocation s'il y en a un à portée.

**Recharges de soins** : un soigneur ignore les alliés en recharge ; sa règle est sautée si aucun allié n'est soignable (en respectant le seuil d'une condition `allyHpBelow`). Même logique pour les Régénérations.

**Stratégies par défaut des types générés** (`ia.ts`, 30 recrutables et 50 monstres) : règles dans cet ordre, selon le rôle (`ai`) de chaque capacité :
1. énergie (`repos`) si énergie < 15 % ; restauration (`second_souffle`) si énergie < 20 % ; volonté (`meditation`, `hurlement`) si volonté < 45 % ;
2. soin de groupe si un allié < 50 % ; soin si un allié < 55 % (sur le plus blessé) ;
3. renfort d'allié (sur le plus blessé, s'il n'a pas l'état, sinon si PV < 70 %) ; renfort de groupe et renfort personnel (si je n'ai pas l'état) ;
4. coup de grâce sur le plus faible ; affaiblissement sur le plus fort s'il n'a pas l'état ; contrôle sur le plus proche s'il n'a pas l'état (sinon si énergie ≥ 60 %) ; zone si ≥ 3 ennemis ;
5. attaques (si la cible a l'état requis, sinon toujours pour un sort à mana, sinon si énergie ≥ 40 %), sur le plus faible si portée ≥ 3, sinon le plus proche ;
6. attaque de base ; puis Attendre (troupe à distance) ou Avancer si aucun ennemi à portée, puis Attendre.

Les 10 troupes du banc d'essai et les 7 monstres d'origine ont des règles écrites à la main. Toutes les stratégies par défaut sont listées dans l'annexe, section E.

### 5.7 Dégâts

```
Attaque effective  = floor(attaque × max(0, 1000 + Cri de guerre − Affaibli + Rage) / 1000)
Dégâts d'arme      = floor(dégâts de l'arme × multiplicateur / 1000) + attaque effective
Dégâts de sort     = dégâts de base du sort + attaque effective
```

Puis, pour une attaque d'un ennemi (hors tics) :
- **Marque** sur la cible : ×1,3, consomme une utilisation ;
- **Instinct de meute** : ×1,15 si un autre membre de la même troupe a déjà attaqué la cible depuis le dernier tic général ;
- **Cœur ardent** : feu ×1,2 sur une cible qui brûle ;
- bonus d'étiquette (Trait sacré ×2 ou ×3 contre mort-vivant et démon, `tagMult` des sorts `fx`).

Résistance du type : résistance de base + Malédiction (−250 ‰) + Garde (+v) + Peau de pierre / Brise-armure (± v × charges, physique seulement), bornée à [−1 000, 750]. Tir précis ignore la moitié d'une résistance positive.

```
Dégâts finaux = max(1, floor(brut × (1000 − résistance) / 1000))
```

Un **Bouclier** absorbe d'abord (et disparaît à 0). Les PV perdus font baisser la volonté : `floor(perte × volontéMax × 500 / (PVmax × 1000))` (pas sous Rage). **Lien vital** renvoie 30 % de la perte sur l'unité liée. **Riposte** (réaction, 10 énergie, pas étourdi ni gelé) contre-attaque une attaque au contact à 0,5× l'arme. **Épines** renvoie `v` dégâts tranchants à chaque attaque au contact. **Dernier rempart** (passif, une fois par combat) retient à 1 PV un allié du même rang qui devait mourir, et coûte 20 % de volonté.

8 types de dégâts : contondant, tranchant, maladie, psychique, feu, glace, ténèbres, sacré.

### 5.8 Soins et recharges [Xavier]

- Tout soin en combat est multiplié par `healMult` = 1,2 (sorts de soin, prières, régénération, drains, Second souffle).
- **Soins directs** (Soin mineur, Soin majeur, Prière collective, Cercle de soins) : une unité soignée ne peut plus être soignée par un sort direct pendant **60 instants**. Un soin de groupe est sans effet sur les alliés en recharge.
- **Régénération** (Régénération, Sève régénératrice) : une unité qui en reçoit une ne peut pas en recevoir une autre pendant **100 instants**. Recharge séparée de la précédente.
- Drains et consommables ne sont pas concernés.

### 5.9 États

| État | Effet |
|---|---|
| Saignement / Poison / Brûlure | Dégâts tranchant / maladie / feu `v × charges` à chaque tic rapide (tous les 4 instants). |
| Régénération | Soin de `v ‰` des PV max à chaque tic rapide. |
| Hâte / Ralenti | Durée des actions ×0,75 / ×1,25. |
| Étourdi | Repousse la prochaine action de la durée de l'étourdissement. |
| Gelé | L'unité ne joue pas jusqu'à la fin du gel. |
| Bouclier | Absorbe `v` dégâts (le plus grand des deux si renouvelé). |
| Marque | +30 % aux `v` prochaines attaques reçues. |
| Provocation | Les attaques ennemies à portée doivent la viser. |
| Confusion | La prochaine action est un demi-échec. |
| Cri de guerre | Attaque +`v` ‰. |
| Affaibli | Attaque −`v` ‰. |
| Peau de pierre / Brise-armure | Résistance physique ± `v` × charges. |
| Malédiction / Garde | Résistance à tout ± `v` ‰. |
| Arme enflammée | Chaque attaque d'arme ajoute `v` feu et une Brûlure. |
| Lien vital | Renvoie 30 % des dégâts subis sur l'unité liée. |
| Silence | Interdit les capacités à mana. |
| Épines | Renvoie `v` tranchant au contact. |

Règles générales :
- Un état renouvelé prolonge sa fin (le max des deux), remplace sa valeur ; les états cumulables gagnent une charge jusqu'à leur plafond (Poison 3 ou 5, Brise-armure 3).
- **Dégâts et soins sur la durée 5 fois plus rapides** [Xavier] : à l'application, la durée de Saignement, Poison, Brûlure et Régénération est convertie en `max(4, round(durée × 4 / 20))` ; les tics tombent tous les 4 instants. Le total par application est le même qu'avant, mais une nouvelle application écrase moins souvent la précédente : sur un combat, ces états infligent environ 2 fois plus.
- **Gel nerfé** [Xavier] : Flèche de givre gèle 20 instants (au lieu de 40) une cible déjà ralentie ; une cible gelée ne peut plus être regelée pendant 100 instants après la fin du gel.
- Non-mort : insensible au Poison et au Saignement. Contagion : le poison d'un ennemi qui meurt passe au plus proche de ses alliés.
- Tous les états disparaissent à la mort et à la fin du combat (rien n'est conservé entre deux combats).
- États « négatifs » (retirés par Purification) : Saignement, Poison, Brûlure, Ralenti, Étourdi, Gelé, Marque, Confusion, Malédiction, Brise-armure, Lien vital, Affaibli, Silence, Peau de pierre négative.

### 5.10 Capacités

Deux familles :
- **Capacités codées dans le moteur** (59, celles du banc d'essai) : chacune a sa résolution propre pour la réussite, le demi-échec et l'échec critique (ex. Emploi d'arme : demi-échec = frappe un autre ennemi, échec critique = se frappe). Le texte exact de chacune est dans l'annexe B.
- **Capacités décrites par des données** (33, `fx`) : liste d'effets génériques résolus dans l'ordre.
  - Effets : `dmg` (dégâts de sort, `v` + attaque), `wdmg` (multiplicateur d'arme `v` ‰), `drain` (dégâts de sort, soigne le lanceur de la moitié), `heal` (`v` ‰ des PV max), `state` (applique un état, valeur, durée, plafond), `will`, `mana`, `energy` (`v` ‰ du max, positif ou négatif), `stun` (durée), `push` / `pull` (rangs), `cleanse` (retire les états négatifs).
  - Zones : cible, rang de la cible, tous les ennemis, ennemis des rangs effectifs 1-2, soi, tous les alliés, alliés du rang du lanceur.
  - Option : bonus contre une étiquette, effet seulement si la cible a un état.
  - **Demi-échec** : valeurs et durées divisées par 2 (sauf déplacements), zones réduites à la cible.
  - **Échec critique** : un sort offensif applique son premier effet sur le lanceur, à moitié ; un sort de soutien est perdu.

### 5.11 Fin du combat

- Un camp sans unité en jeu (morte ou en fuite) perd. Si le joueur a tout perdu ou tout fait fuir, c'est une défaite.
- Durée limite de 3 000 instants atteinte : **défaite du joueur**.
- Médiane des durées mesurées : 150 à 260 instants selon la région.

### 5.12 Journal

Le moteur produit un journal d'événements horodatés, seule donnée nécessaire à la rediffusion (le client ne recalcule rien) : `start` (unités au départ), `act` (unité, règle, capacité, cible), `wait`, `frozen`, `will` (pourcentage, résultat, forcé), `move`, `hit` (source, cible, type, brut, final, absorbé, cause), `gauge` (jauge, avant, après, cause), `state` (ajout, renouvellement, fin, immunité, charges, fin, valeur), `tick`, `passive` (texte), `lost` (action perdue), `death`, `flee`, `end` (vainqueur, raison).

---

## 6. Rencontres et monstres

### 6.1 Générateur de groupes (`genMonsters`)

Pour une étape (niveaux `[a,b]`, population `[p,q]`, pool, imposés) et une graine :
1. Budget de population tiré entre `p` et `q` ; 5 emplacements d'unité.
2. Monstres imposés d'abord (gardien, et monstre rare s'il est présent), chacun à un niveau tiré entre `a` et `b`.
3. Jusqu'à 10 tirages dans le pool parmi les types qui tiennent encore dans la population et les emplacements, pondérés par leur population (les gros d'abord).
4. Chaque point de population non dépensé devient **+1 niveau** sur une troupe au hasard (max 30).
5. Chaque unité a 1 chance sur 4 de décaler son rang de ±1 (borné à 1-3).

Le groupe est tiré à l'arrivée sur l'étape et affiché avant le combat (types, niveaux, nombre d'unités, « puissance » = Σ population × niveau). Le joueur peut donc choisir de combattre ou de partir.

### 6.2 Renfort des monstres par région [Xavier]

Au moment de construire l'entrée du combat, les monstres du territoire `r` reçoivent :

| Région | PV max ×  | Attaque et dégâts d'arme × | Ajustement supplémentaire du gardien (et de son escorte) |
|---|---|---|---|
| 1 Ronces | 1,25 | 1,2 | ×1 |
| 2 Marais | 1,7 | 1,5 | ×1 |
| 3 Mines | 2,3 | 1,9 | ×1,05 |
| 4 Désert | 4,5 | 3,2 | ×0,48 |
| 5 Ciel | 3,8 | 2,8 | ×1,05 |

Formule : `round(valeur × renfort[r] × ajustement / 1 000 000)`. En ligne, chaque étape peut en plus porter un réglage fin `mult` (en ‰, 1 000 par défaut) qui multiplie PV et attaque des monstres de l'étape : il sert à régler la difficulté route par route et étape par étape (`pnpm content simulate`). L'ajustement du gardien s'applique à **toutes les unités** de la rencontre de l'étape 5, escorte comprise. Volonté, énergie, mana, vitesse et résistances ne sont pas renforcés. Les monstres commencent toujours à pleine vie et plein mana.

Historique de ces réglages (pour comprendre les chiffres) : jauges ×3, puis bonus d'équipement ×2 (le jeu équipé devenait trop facile), puis monstres renforcés, +2 niveaux, soins ×1,2 avec recharges, et enfin difficulté croissante par région (« au fur et à mesure de la partie les monstres deviennent de plus en plus faciles, il faudrait l'inverse », Xavier, 3 novembre 2026). Le dragon réagit beaucoup plus fort que les autres gardiens, d'où son ajustement à 0,48.

### 6.3 Bestiaire

77 types : 7 monstres d'origine de la Forêt des Ronces, 50 du bestiaire (dont 4 gardiens), 20 rares. Les monstres utilisent exactement les mêmes règles que les troupes des joueurs (stats, capacités, stratégie). Liste complète avec stats, capacités et butins : annexe, section D.

---

## 7. Objets, stockage et équipement

### 7.1 Familles d'objets

| Famille | Nombre | Pile | Usage |
|---|---|---|---|
| Matériau | 37 (paliers 1 à 5) | 50 | Recettes de recrutement, de craft. Vente. |
| Composant | 10 (rares et de gardien, paliers 2 à 5) | 20 | Obligatoire dans les recettes d'équipement de palier ≥ 3. Récompenses de quêtes. |
| Consommable | 8 | 10 | Soin de PV et/ou de mana hors combat. |
| Trophée | 20 (un par monstre rare) | 20 | Quêtes. Vente. |
| Équipement | 75 bases | 1 (exemplaire unique) | Porté par une unité. |

Chaque objet a une valeur de référence en or (vente, prix, recettes) et des étiquettes (bois, cuir, métal, essence…) qui orientent les recettes. Liste complète : annexe, sections F et G.

### 7.2 Sac et banque

- **Sac** : 20 emplacements, emporté en expédition. **Banque** : 100 emplacements, commune à toutes les villes, accessible seulement en ville.
- Un emplacement = une pile d'objets identiques (jusqu'à la taille de pile) ou un exemplaire d'équipement. Le nombre d'emplacements occupés par un objet empilable = `ceil(quantité / taille de pile)`.
- En ville : transferts sac ↔ banque, vente depuis l'un ou l'autre. En expédition : le sac seulement ; on peut jeter.
- Recrutement, craft, rachat et quêtes puisent **d'abord dans la banque, puis dans le sac**.
- Ce qui est fabriqué ou acheté arrive en banque.
- **Butin qui ne tient pas dans le sac** : il reste « au sol » à l'étape. Le joueur peut jeter quelque chose et le ramasser. Il est **perdu** dès qu'il quitte l'étape : avancer, rebrousser, rentrer en ville ou arriver l'efface ; chercher un nouveau combat sur place ne l'efface pas.

### 7.3 Bases et exemplaires d'équipement

**3 emplacements par unité** : arme, armure, accessoire. Chaque type de troupe accepte certaines catégories par emplacement (annexe C, colonne « Emplacements ») ; certaines bêtes n'ont qu'un collier. Sans arme équipée, l'unité utilise l'arme naturelle de son type.

**14 catégories × 5 paliers = 70 bases**, plus 5 bases réservées au butin des gardiens (non fabricables) :
- armes : une main (lame, masse), deux mains, fronde, arc, bâton, gantelets ;
- armures : légère, moyenne, lourde, robe ;
- accessoires : bottes, anneau, collier.

| Palier | Niveau requis | Budget de stats | Nombre de stats | Valeur (accessoires ×0,85) | Dégâts d'arme ×  |
|---|---|---|---|---|---|
| 1 | 1 | 10 | 2 | 30 | 1 |
| 2 | 6 | 20 | 2 | 70 | 1,25 |
| 3 | 11 | 35 | 3 | 140 | 1,55 |
| 4 | 16 | 55 | 3 | 260 | 1,9 |
| 5 | 21 | 80 | 4 | 450 | 2,3 |

Une arme définit les dégâts, le type, la vitesse et le coût en énergie de l'unité (elle remplace l'arme naturelle). Certaines armes changent de type selon le palier (ex. lame de palier 4 en feu, de palier 5 en sacré).

**Génération d'un exemplaire** (`genEquip`), à la fabrication, au butin, à l'achat ou en récompense. Les stats sont tirées une fois, puis figées.
1. `N` = nombre de stats de la base (ou du palier), au plus la taille du pool.
2. **Jet de puissance** `roll` (‰) = moyenne de deux tirages uniformes entre 600 et 1 400 (cloche centrée sur 1 000). Le marchand vend avec un jet fixe de 800 ; les quêtes donnent 1 250 à 1 400.
3. `N` stats tirées sans remise dans le pool de la base selon leurs poids.
4. Budget = `max(N, floor(budget du palier × roll / 1000))`.
5. Répartition : chaque stat reçoit 15 % du budget, le reste est réparti selon des poids aléatoires (1 à 100).
6. Valeur de la stat = `max(1, floor(points × coût))` avec les coûts par point de budget : attaque 1, PV 5, volonté 3, énergie 4, mana 3, résistance 2 %, dégâts d'arme 1, vitesse d'arme −0,25 (plafonnée à −3), coût d'arme −0,5.
7. Une résistance prend le type imposé par le pool s'il n'est pas déjà pris, sinon un type au hasard parmi ceux restants. Deux stats identiques fusionnent.

**Qualité affichée** (dérivée du jet) : < 850 médiocre, < 1 050 correct, < 1 200 bon, sinon excellent.

**Valeur d'un exemplaire** = `round(valeur de la base × roll / 1000)`.

### 7.4 Effet de l'équipement sur les stats

Les bonus d'équipement sont **doublés à l'usage** (`ITEM_BOOST = 2` [Xavier]), y compris pour les objets déjà existants et dans l'affichage. Puis les jauges suivent le multiplicateur ×3 :

| Stat de l'objet (valeur `v`) | Effet sur l'unité |
|---|---|
| Attaque | +2v |
| PV max | +2v × 3 |
| Volonté max | +2v |
| Énergie max | +2v × 3 |
| Mana max | +2v × 3 |
| Résistance type | +2v % |
| Dégâts de l'arme | +2v |
| Vitesse de l'arme | −2v (vitesse au moins 8) |
| Coût de l'arme | −2v (coût au moins 1) |

Équiper : depuis la banque (en ville) ou le sac (partout, entre deux combats). L'objet remplacé retourne d'où vient le nouveau. Retirer : vers la banque en ville, vers le sac en expédition (il faut de la place). Conditions : catégorie acceptée par le type, niveau de la troupe ≥ niveau requis du palier. Après un changement, PV et mana courants sont bornés au nouveau maximum (au moins 1 PV).

### 7.5 Consommables

Utilisables partout entre deux combats, sur une unité précise ; en ville pris dans le sac d'abord puis la banque, en expédition dans le sac seulement. Effet = `+ceil(max × % / 100)`. Refusé si la jauge visée est déjà pleine.

| Objet | Effet | Palier | Valeur |
|---|---|---|---|
| Bandage | +15 % PV | 1 | 6 |
| Potion de soin mineure | +30 % PV | 1 | 12 |
| Potion de mana mineure | +40 % mana | 1 | 12 |
| Potion de soin | +50 % PV | 2 | 25 |
| Potion de mana | +80 % mana | 2 | 25 |
| Potion de soin majeure | +80 % PV | 3 | 50 |
| Tonique | +25 % PV et mana | 3 | 40 |
| Onguent de remise | +100 % PV (butin rare, palier 5, non fabricable) | 5 | 90 |

---

## 8. Économie : or, marchand, recrutement, atelier, recettes personnelles, butin

### 8.1 Départ d'une partie [H]

- 1 000 or [Xavier, 5 novembre 2026 ; 200 auparavant].
- Deux Miliciens, deux Chasseurs et deux Herboristes niveau 1, engagés (un Milicien et un Chasseur dans le prototype : trop peu pour la première route en ligne).
- En banque : 3 bandages et les ingrédients de **sa propre** recette de recrutement de l'Acolyte (donc un premier recrutement possible, l'Acolyte coûtant 40 or).
- 5 quêtes générées dans chacune des 5 villes.
- Position : Havre-Gris.

### 8.2 Sources et puits d'or

| Sources | Puits |
|---|---|
| Or des victoires (section 8.6) | Recrutement et rachat (or de la recette) |
| Vente au marchand (20 % de la valeur) | Craft d'équipement (6 × palier² or) |
| Or des quêtes | Achat au marchand (150 % de la valeur) |
| | Renoncer à une quête (10 × palier de la ville) |

Puits d'objets : recrutement, craft, quêtes (trophées), mort des unités (équipement détruit), butin perdu au sol. Les soins au temple sont gratuits.

### 8.3 Marchand

- Vend dans chaque ville : 5 bases d'équipement du palier de la région (jet fixe 80 %, qualité « médiocre »), Bandage et Potion de soin mineure, plus Potion de soin et Potion de mana dès le palier 2. Stock illimité.
- Prix d'achat = `ceil(valeur × 1,5)`. Rachat de tout objet = `max(1, floor(valeur × 0,2))` (valeur de l'exemplaire pour l'équipement).
- Le marchand de Havre-Gris vend aussi un **Milicien pour 300 or** [Xavier, 5 novembre 2026] : il arrive au niveau 1, en escouade s'il y tient, sinon en caserne (liste `city.troops` du contenu).
- Il n'y a pas encore de marché entre joueurs.

### 8.4 Recrutement

- Chaque ville recrute ses 8 types. Une recrue arrive au **niveau minimal de la région** de sa ville (1, 6, 11, 16 ou 21), sans équipement, à pleine vie.
- Coût = recette personnelle du joueur pour ce type : ingrédients + `40 × population × numéro de région` or.

### 8.5 Recettes personnelles (mécanique centrale pour l'échange)

Chaque joueur a ses propres recettes, **fixes pour lui et différentes pour chaque joueur**, tirées une fois pour toutes à partir de sa graine (`genRecipes`) : recrutement des 40 types, 70 bases d'équipement fabricables, 7 consommables. Toutes les recettes ont un **coût total équivalent d'un joueur à l'autre** (± 10 % de la cible), seuls les ingrédients changent.

Paramètres par recette :

| Recette | Palier | Cible de valeur des ingrédients | Nombre d'ingrédients | Or |
|---|---|---|---|---|
| Équipement | palier de la base | `round(valeur de la base × 0,7)` | 2-3 (palier 1), 3-4 sinon ; + 1 composant dès le palier 3 | `6 × palier²` |
| Consommable | palier de l'objet | `max(4, round(valeur × 0,7))` | 2 | 0 |
| Recrue | `max(région, 2 si pop ≥ 3 en région 1, sinon 1)` | `round(14 × pop × [1 ; 2,5 ; 5 ; 9 ; 15][région])` | 2-3 (palier 1), 3-4 sinon | `40 × pop × région` |

Algorithme (pour chaque recette, dans un ordre fixe, avec une graine `hash(graine joueur, 'recette', id)`) :
1. Pool : matériaux de palier ≤ palier de la recette, sauf les matériaux « réservés à l'échange » du joueur (ci-dessous).
2. Composant obligatoire (équipement palier ≥ 3) : tiré parmi les composants de palier `T−1` à `T` dont la valeur ≤ 40 % de la cible ; sa valeur est retirée de la cible.
3. Jusqu'à 12 essais : tirer `n` ingrédients distincts, au moins un du palier de la recette (dès le palier 2). Poids d'un matériau : ×3 s'il partage une étiquette avec la recette, divisé par `(1 + 1,5 × k)` s'il est déjà utilisé dans `k` recettes du joueur (dispersion). Puis augmenter les quantités jusqu'à entrer dans la fourchette ± 10 %. Garder l'essai le plus proche de la cible.

**Matériaux réservés à l'échange** (`tradeOnly`) : pour chaque joueur, 7 matériaux tirés au hasard (3 de palier 1, 1 de chaque palier 2 à 5) **n'entrent dans aucune de ses recettes**. Ils ne lui servent qu'à vendre ou échanger, et sont marqués « inutile pour vous ». C'est la base voulue du commerce entre joueurs (« oreilles de gobelin »).

### 8.6 Butin d'une victoire (`rollLoot`)

- **Or** = `round(or de base de l'étape × (80 à 120) / 100)`.
- Matériaux possibles : ceux de l'étape + les butins des monstres rencontrés. Composants possibles : ceux des monstres rencontrés.
- **Tirages** : `draws` tirages (1-2, 2 ou 2-3 selon l'étape), chacun pondéré **85 % matériau, 5 % composant, 7 % consommable, 3 % équipement** :
  - matériau : poids 1 au palier de l'étape, 0,5 en dessous, 0,3 au-dessus ; quantité 1-2 si palier ≥ celui de l'étape, sinon 1-3 ;
  - composant : un composant des monstres, sinon un matériau du palier de l'étape ;
  - consommable : selon le palier (bandages et potions mineures en début, potions majeures et toniques dès le palier 3, onguent au palier 5) ;
  - équipement : une base fabricable de palier `T−1` ou `T` (poids 2 pour `T`), jet normal.
- **Gardien** : en plus, un tirage garanti pondéré **50 % composant, 30 % équipement, 20 % matériau** ; l'équipement a 1 chance sur 2 d'être la base réservée au gardien (Armure d'écorce vivante, Cape des Noyés, Poings du Cœur-de-Forge, Écailles du dragon de cendre, Diadème de l'aube). À la **première victoire** sur le gardien de la région, objet fixe en plus : Cœur de ronce, Cœur du marais, Gemme profonde, Cœur de dragon, Couronne de l'aube.
- **Monstre rare** présent : son trophée est toujours ajouté (section 9).
- Les piles identiques sont regroupées puis versées dans le sac ; le reste va au sol.

---

## 9. Monstres rares et quêtes [Xavier, 3 novembre 2026]

### 9.1 Monstres rares

- **20 rares**, un par étape ordinaire (étapes 1 à 4 de chaque territoire, pas à l'étape du gardien). Chacun est un champion nommé, dérivé d'un monstre de l'étape (ex. Croc-de-Givre d'après le Loup gris, Grishnak le Balafré d'après les Gobelins pillards). Liste : annexe H.
- Construction : 1 unité, 2 de population ; PV de base × 2,4 × nombre d'unités du modèle × réglage du rare ; volonté × 1,3 ; attaque + `round(3 × max(1, réglage))` ; croissance de PV multipliée de même ; capacités et stratégie du modèle. Réglages (PV) : Épaves, Tertre, Puits 0,8 ; Filons 0,9 ; Dunes 1,2 ; Tombeaux 1,5 ; Parvis, Jardins 0,7 ; les autres 1. Il reçoit ensuite le renfort de sa région comme tout monstre.
- **Apparition** : dans 15 % des rencontres de son étape [H], seulement quand le joueur a au moins **10 victoires** au total [H] (une escouade de départ ne peut pas le battre). Il est imposé dans le groupe et consomme 2 points du budget de population de la rencontre.
- Le tirage dépend de `(graine du joueur, étape, numéro du départ en expédition, nombre de combats livrés)` : rebrousser chemin puis revenir, ou chercher un autre combat sans avoir combattu, ne le relance pas ; combattre ailleurs, ou rentrer en ville et repartir, si.
- Vaincu, il laisse **toujours** son trophée (palier = région, valeur = `20 × région²` or).

### 9.2 Générateur de quêtes (`genQuest`)

Quête numéro `n` de la ville `v`, déterministe pour une graine de joueur (`hash(graine, 'quete', v, n)`) :
1. **Territoire** des trophées : celui qui part de la ville (70 %) ou celui qui y arrive (30 %, sauf en ville 1). On note `T` son palier.
2. **Type de récompense** : équipement 40 %, troupe 25 %, objets 35 %.
3. **Trophées demandés** : 1 sorte (60 %) ou 2 sortes (40 %) parmi les 4 rares du territoire. Chaque trophée vaut `2 + index de l'étape` points (2 à 5). On part d'un exemplaire par sorte, puis on ajoute des exemplaires au hasard (4 au plus par sorte) jusqu'à atteindre un objectif tiré : 4-6 points (objets), 6-9 (équipement), 9-12 (troupe).
4. **Or** = `round(points × 5 × T²)`.
5. **Récompense** :
   - équipement : une base fabricable du palier `T`, jet tiré entre 1 250 et 1 400 (au-dessus du maximum possible d'un craft) ;
   - troupe : un type recrutable des villes 1 à `T`, pondéré 2 pour les villes autres que celle de la quête et 1 pour elle, au niveau `niveau minimal de T + 3` ;
   - objets : 1-2 composants de palier `T+1` à `T+2` (bornés à 5), 3-5 d'un consommable, parfois 2-4 d'un second, et 1 onguent (1 chance sur 3) si `T ≥ 4`.
6. Donneur tiré parmi 5 personnages de la ville, titre et texte tirés parmi des modèles.

### 9.3 Tableau des quêtes

- **5 quêtes par ville**, visibles dans toutes les villes dès le début.
- **Rendre** : en ville, si le joueur possède tous les trophées (banque puis sac). Les trophées sont consommés, l'or et la récompense versés (équipement en banque sinon dans le sac ; objets en banque puis sac, il faut autant d'emplacements libres que de lignes ; troupe en escouade si elle tient, sinon en caserne). La quête est aussitôt remplacée par la suivante (`n+1`).
- **Renoncer** : coûte `10 × palier de la ville` or [H], remplace la quête.

---

## 10. Interface et déroulé d'une partie

Onglets : **Ville** (en-tête, départs, quêtes, temple et rachat, routes, marchand, caserne, journal), **Expédition**, **Troupes** (escouade, rang, stratégie, XP, équipement par unité), **Atelier** (filtres, recettes, dernier objet fabriqué), **Banque et sac**, **Dernier combat**, **Codex** (consultation de tout le contenu), **Labo** (outils de réglage), **Partie** (graine, statistiques, nouvelle partie).

En-tête : or, sac occupé, population de l'escouade, lieu.

### 10.1 Expédition

Affiche le parcours (5 étapes, la courante, celles dégagées), le groupe de monstres en vue (avec un bandeau « monstre rare » le cas échéant), la puissance estimée des deux camps, et les actions : Combattre, Chercher un combat (si aucun groupe en vue), Avancer, Arriver (dernière étape dégagée), Rebrousser, Rentrer. Plus l'escouade avec ses jauges et l'usage de consommables, le sac, le butin au sol.

### 10.2 Combat non passable [Xavier]

- Après « Combattre », le combat est calculé, ses conséquences appliquées tout de suite, puis la partie passe en mode **« à regarder »** (`watch = true`).
- Tant que la rediffusion n'est pas arrivée au bout, toutes les autres actions de jeu sont refusées (départ, arrivée, avancer, rebrousser, chercher, combattre, rentrer, quêtes) et l'interface reste sur l'onglet du combat, **même après un rechargement de la page**.
- Vitesses : lent 10, normal 25 (défaut), rapide 50, très rapide 100 instants par seconde. Pas de saut ni de curseur pendant la première lecture (une barre de progression seulement). Au bout : bilan et bouton « Continuer », qui lève le blocage.
- Ensuite, le dernier combat reste revoyable en pixel art (avec curseur) ou en vue tableau avec le journal détaillé.

### 10.3 Vue 8 bits

Canvas 256 × 144 pixels : escouade à gauche, monstres à droite, trois rangs par camp, ligne de front au milieu. Sprites dessinés dans le code pour les types du banc d'essai, apparences générées pour les autres (d'après étiquettes, population, arme, lanceur de sorts, tir), décor propre à chaque région, couleurs propres aux nouveaux sorts. Points d'état à droite des unités, « ? » pour une désobéissance, « !! » pour la panique, « ... » pour l'attente, rang réel et rang compté sous chaque camp. La vue est purement une lecture du journal.

### 10.4 Labo (outil de développement)

Trois générateurs réglables à la main : groupes de monstres (niveaux, population, pool, imposé, graine, puis simulation de 100 combats contre une copie de l'escouade à pleine vie), exemplaires d'équipement (12 tirages d'une base), recettes personnelles comparées entre plusieurs graines de joueurs. **À réserver aux administrateurs** en ligne.

---

## 11. État de la partie et sauvegarde

### 11.1 Stockage actuel

- Clé `localStorage` `proto.ville.v1` : tout l'objet `Game` en JSON, réécrit après chaque action. Préférences : `proto.ville.tab` (onglet), `proto.ville.pxspeed` (vitesse de rediffusion).
- Au chargement : si `v ≠ SAVE_VERSION (2)`, nouvelle partie ; sinon `upgradeSave` (remet PV et mana courants à l'échelle si `GAUGE_MULT` a changé depuis la sauvegarde, complète les quêtes manquantes).

### 11.2 Modèle `Game` (état complet d'un joueur)

```ts
Game {
  v: 2;                       // version de sauvegarde
  seed: number;               // graine du joueur (recettes, matériaux réservés, rencontres, quêtes…)
  gold: number;
  where: 'ville' | 'territoire';
  region: number;             // 0-4 : ville actuelle, ou ville de départ de l'expédition
  unlocked: number;           // ville la plus lointaine atteinte (affichage)
  terr?: number;              // territoire parcouru (0-4)
  dir?: 1 | -1;               // sens du parcours
  step: number;               // étape courante (0-4)
  cleared: boolean[5];        // étapes dégagées pendant ce départ
  encounter: { seed, side: { troops: TroopSetup[] }, rare?: string } | null;
  guardians: boolean[5];      // gardien déjà vaincu (objet de première victoire)
  bag:  Store;                // { stacks: { idObjet: quantité }, equip: ItemInst[] }
  bank: Store;
  troops: Troop[];
  recipes: Record<idSortie, Recipe>;   // { out, kind: 'equip'|'consommable'|'recrue', ingredients: [id, qté][], gold, budget }
  counter: number;            // compteur de tirages (consommé par chaque aléa de jeu)
  pending: Loot[];            // butin au sol
  journal: string[];          // 60 dernières lignes
  last: BattleRecord | null;  // dernier combat : entrée complète, journal complet, résultat, XP, morts, butin…
  stats: { fights, wins, deaths, crafts };
  gauges?: number;            // GAUGE_MULT au moment de la sauvegarde
  watch?: boolean;            // rediffusion obligatoire en cours
  quests?: Quest[][];         // 5 par ville
  questN?: number[];          // prochain numéro de quête par ville
  questsDone?: number;
  outings?: number;           // nombre de départs en expédition
}
Troop { uid, type, level, xp, form, units: UnitState[], rank: 1|2|3, squad: boolean, bornAt: number,
        strat?: { active: string[], rules: Rule[] } }
UnitState { hp, mana, equip: { arme?: ItemInst, armure?: ItemInst, accessoire?: ItemInst } }
ItemInst { uid, base, roll, stats: { k, type?, v }[] }
Quest { id, region, giver, title, text, needs: [trophée, n][], reward, gold }
TroopSetup { type, level, form, active, rules, units: { dist, hpPct, manaPct }[] }
BattleRecord { input, log, result, region, step, won, xp, xpBy, manaBack, levelUps, deaths, gold, loot, lost }
```

Ce qui n'est **pas** sauvegardé parce que dérivé : stats des unités (recalculées à partir du type, du niveau et de l'équipement), matériaux réservés (recalculés depuis la graine), stratégie par défaut.

### 11.3 Effets d'un combat sur l'état (`fight`)

Dans cet ordre, en une seule commande :
1. Construction de l'entrée : unités de l'escouade (ordre des troupes puis des unités), PV et mana courants, rang de la troupe, capacités actives, règles ; monstres renforcés (6.2).
2. Simulation avec la graine `hash(graine de la rencontre, 'combat')`.
3. Compteurs `fights` (+1) et `wins`.
4. Pour chaque unité : morte → retirée avec son équipement, `deaths` +1 ; survivante → PV = max(1, PV finaux), mana = min(max, mana final + 25 % du max) [Xavier]. Troupes vides supprimées.
5. Victoire : XP et niveaux, or, butin (avec trophée du rare), étape dégagée, gardien marqué, rencontre effacée.
6. Défaite, ou plus aucune troupe dans l'escouade : **repli forcé** vers la ville de départ (le sac est gardé, le butin au sol perdu).
7. `last` = bilan complet, `watch = true`.

---

## 12. Aléa et graines

- PRNG : xoshiro128** (`Rng`), initialisé par une graine 32 bits. Hachage de dérivation : FNV-1a de `parts.join('|')` combiné à la graine (`hash(seed, ...parts)`).
- **Graine du joueur** : tirée au hasard (`Math.random`) à la création de la partie, ou saisie dans l'onglet Partie. Elle fixe les recettes, les matériaux réservés et les quêtes.

| Tirage | Graine |
|---|---|
| Recettes | `hash(graine, 'recette', idSortie)` |
| Matériaux réservés | `hash(graine, 'echange')` |
| Rencontre | `hash(graine, 'rencontre', idÉtape, counter++)` puis groupe `hash(rencontre, 'monstres')` |
| Combat | `hash(rencontre, 'combat')` |
| Butin | `hash(graine du combat, 'butin')` |
| Rare présent | `hash(graine, 'rare', idÉtape + '|' + outings, fights) % 100 < 15` |
| Quête | `hash(graine, 'quete', ville, n)` |
| Craft, achat, récompense, nouvelle troupe | `hash(graine, quoi, counter++)` |

Conséquence : tout est reproductible à partir de la graine et du compteur. C'est utile pour les tests, mais en ligne cela veut dire que **quiconque connaît la graine peut prédire** ses recettes, ses rencontres, l'issue exacte de chaque combat et son butin (section 13).

---

## 13. Ce qui est côté client et doit passer côté serveur

Aujourd'hui **tout** est dans le navigateur : l'état, les règles, les générateurs, le moteur, la graine. Pour un jeu en ligne avec échanges, le serveur doit devenir autoritaire (architecture A10) : le client n'envoie que des intentions, le serveur vérifie, tire l'aléa, applique et renvoie le nouvel état ou le journal.

### 13.1 Répartition cible

| Élément | Aujourd'hui | En ligne |
|---|---|---|
| État `Game` | `localStorage`, modifiable à la main | Base de données, une ligne par entité (joueur, troupe, unité, exemplaire, pile, quête, combat). Le client ne lit qu'une vue. |
| Commandes de `jeu.ts` | Fonctions locales | Commandes serveur, une transaction chacune, verrou sur le joueur, clé d'idempotence. Mêmes conditions et mêmes messages d'erreur. |
| Graine du joueur | Visible dans l'onglet Partie, choisie par le joueur | Secrète, tirée par le serveur (générateur cryptographique). Jamais envoyée au client. |
| Recettes personnelles | Calculées et stockées dans la sauvegarde | Calculées au serveur à la création du compte, stockées (et liées à la version du contenu). Le client voit ses recettes, pas celles des autres (sauf choix de design). |
| Matériaux réservés | Recalculés depuis la graine côté client | Calculés au serveur, envoyés comme simple étiquette « inutile pour vous ». |
| Rencontres (`genMonsters`) | Client | Serveur, graine secrète. La composition est montrée au joueur (comme aujourd'hui), pas la graine du combat. |
| Présence d'un rare | Prévisible par le client | Serveur. |
| Moteur de combat | Client | Serveur. Le client reçoit l'entrée et le journal pour la rediffusion. Le paquet moteur peut rester partagé pour les types. |
| Graine du combat | Dérivée de la rencontre, donc connue avant de combattre | Tirée au moment de « Combattre », dans la même transaction que l'application du résultat. |
| Butin, XP, niveaux, morts | Client | Serveur, même transaction que le combat. |
| Génération d'équipement (craft, achat, quête, butin) | Client | Serveur. Identifiant d'exemplaire = identifiant en base (aujourd'hui un `uid` tiré du PRNG). |
| Quêtes | Générées et stockées côté client | Générées et stockées au serveur. |
| Blocage « combat à regarder » | Booléen côté client, levé par le bouton Continuer | Serveur : refuser les commandes de jeu jusqu'à un instant `watchUntil` calculé (ex. durée du combat ÷ 100 instants/s, la vitesse ×4), ou jusqu'à un accusé de fin de lecture plus ce délai minimal. À décider avec Xavier. |
| Validation de la stratégie | Interface seulement | Serveur : capacités connues, 6 actives au plus, attaque de base incluse, vocabulaire fermé (conditions, cibles, états), valeurs bornées, nombre de règles plafonné (aujourd'hui sans limite). |
| Contenu (troupes, monstres, sorts, objets, régions, `ECO`) | Constantes dans le bundle | Pack de contenu versionné chargé par le serveur, envoyé au client en lecture (Codex). |
| Labo, nouvelle partie avec graine choisie | Ouverts à tous | Administration seulement. |
| Rediffusion, Codex, éditeur de stratégie, vue 8 bits | Client | Client (inchangé). |

### 13.2 Failles qui existent aujourd'hui et que le serveur doit fermer

1. **Sauvegarde modifiable** : or, objets, niveaux, tout se change dans le `localStorage`.
2. **Issue prévisible** : la graine du combat dépend de la rencontre, connue avant de combattre ; avec la graine du joueur et le moteur, on peut simuler le combat exact avant de le livrer (le Labo simule même 100 combats contre son escouade).
3. **Relance de rencontre sans limite** : la commande `searchFight` tire un nouveau groupe à tout moment, même si un groupe est en vue (l'interface ne propose le bouton que s'il n'y a pas de groupe, mais la commande ne le vérifie pas). Idem pour `back` puis `advance`. En ligne : décider si l'on peut fuir une rencontre vue (aujourd'hui oui en rentrant en ville ou en rebroussant) et faire vérifier la règle par le serveur.
4. **Blocage de rediffusion** contournable en effaçant `watch`.
5. **Rang, stratégie, équipement depuis le sac** sont modifiables sans contrôle de moment ; c'est voulu (entre deux combats), mais le serveur doit refuser pendant le blocage de rediffusion.
6. **Rare** : sa présence se calcule à l'avance à partir de la graine.

### 13.3 Ce que le multijoueur ajoute et que le prototype ignore

- Plusieurs joueurs partagent le même contenu et la même économie : l'inflation d'or et d'objets devient un sujet (aujourd'hui marchand à stock illimité et soins gratuits).
- Les matériaux réservés et les recettes personnelles n'ont de sens qu'avec un **échange entre joueurs** (marché ou échange direct), qui n'existe pas encore. Le cadrage prévoit marchés par faction, ville neutre, échange direct dans la même ville, troupes échangeables (D4 à D8).
- Biens uniques à un seul endroit à la fois, verrous (objet équipé, troupe engagée ou en vente), journal des mouvements, grand livre de l'or (architecture A6, A7).
- Version du moteur et du contenu enregistrée avec chaque combat, pour rejouer les anciens journaux.

---

## 14. Écarts avec les specs, fonctions prévues mais absentes

### 14.1 Prévu dans le cadrage ou les specs, absent du prototype

- **Factions** (3), bonus et troupes exclusives, marchés de faction, ville neutre, villes fermées aux autres factions.
- **Évolutions** des troupes (formes aux niveaux 10, 15, 20 avec embranchement) : définies dans `content.ts` pour les 10 troupes du banc d'essai, jamais appliquées. Une troupe reste dans sa forme de départ, donc certaines capacités ne sont jamais apprises (Provocation et Riposte du Milicien, Régénération et Bouclier de foi de l'Acolyte, etc.). Les 30 nouveaux types n'ont qu'une forme.
- **Main secondaire** (4e emplacement d'équipement) : seulement 3 emplacements.
- **Réserve** de troupes emmenée en expédition et remplacements entre deux combats (D11).
- **Marché et échange direct** entre joueurs, taxe de marché.
- **Démontage** d'équipement (~30 %), agrandissement de la banque.
- **Monde** : la spec objets prévoit 15 maps en 4 régions et un graphe de chemins avec garnisons ; le prototype a 5 régions en ligne, une ville et un territoire chacune.
- **Déblocage définitif des chemins** (cadrage 5.1 [H]) : remplacé par la règle de Xavier, chaque traversée se refait entière.
- Tableau de contribution par faction.

### 14.2 Décisions du prototype qui remplacent des specs antérieures

- Voyage uniquement par traversée complète d'un territoire, dans un sens comme dans l'autre, gardien au bout (Xavier, 3 novembre 2026).
- Jauges ×3, durée limite 3 000 (au lieu de 1 000 dans la spec combat).
- Tics de dégâts/soins sur la durée tous les 4 instants (spec : 20).
- Soins ×1,2, recharges de soin par cible (60 et 100 instants).
- Attendre rend aussi 5 % du mana ; +25 % de mana à la fin de chaque combat.
- Rang effectif (rangs vides retirés des portées), avancée automatique en cas de combat bloqué, attaque de base toujours active.
- Bonus d'équipement ×2.
- Combats non passables, rediffusion obligatoire.

---

## 15. Équilibrage mesuré

Mesures de `test.ts` (escouades tirées au hasard parmi les recrues de la ville, 5 de population, pleine vie, équipées au palier de la région avec un jet moyen, au niveau d'entrée de la région), après le dernier réglage « difficulté croissante par région » :

| Région | Étapes 1-4 (moyenne) | Gardien | Gardien avec 6 niveaux de plus |
|---|---|---|---|
| Ronces | 100 % | 23 % | 75 % |
| Marais | 81 % | 34 % | 59 % |
| Mines | 67 % | 29 % | 50 % |
| Désert | 59 % | 29 % | 36 % |
| Ciel | 53 % | 24 % | 23 % |

Rencontre avec rare (étapes 1 à 4), mesurée avant ce dernier réglage : Ronces 100/100/100/87 %, Marais 98/85/75/62 %, Mines 100/97/87/70 %, Désert 100/100/98/98 %, Ciel 92/90/97/92 % ; les rares du Désert et du Ciel ont ensuite été adoucis.

Constats :
- L'équipement du palier pèse beaucoup plus que les niveaux gagnés : sans équipement, les régions 3 à 5 sont nettement plus dures. À surveiller.
- Bot de la région 1 (avant le renfort par région) : gardien battu dans 18 parties sur 60 avec les soins réglés à ×1,2 et les recharges.

Le réglage est fait par Xavier en jouant ; tout chiffre marqué [Xavier] ne doit pas changer sans lui.

---

## 16. Bizarreries du code à trancher avant de réécrire

Comportements actuels qui ressemblent à des accidents. La version en ligne doit soit les reproduire à l'identique (pour garder l'équilibrage mesuré), soit les corriger en connaissance de cause.

1. **Embrasement** calcule les tics de brûlure restants avec la période de 20 instants (`P.tick`) alors que les brûlures tiquent maintenant tous les 4 : il compte environ 5 fois moins de dégâts restants que prévu.
2. **L'ajustement du gardien** s'applique à toute la rencontre de l'étape 5, escorte comprise (utile pour le Dragon à ×0,48, qui adoucit aussi son escorte).
3. **L'XP n'est pas partagée** entre les troupes : chacune reçoit le total. Une escouade de 5 troupes d'une unité gagne 5 fois plus d'XP au total qu'une escouade d'une seule troupe. **Tranché par Xavier le 3 novembre 2026 : en ligne, l'XP est partagée entre les troupes de l'escouade.**
4. **`allyHpBelow`** compte l'unité elle-même parmi les alliés.
5. Les **règles par défaut** contiennent des capacités que la troupe n'apprendra jamais faute d'évolution ; elles sont filtrées pour les troupes de joueur mais restent dans le contenu.
6. **`searchFight`** ne vérifie pas qu'aucun groupe n'est en vue (13.2, point 3).
7. Le rare consomme 2 points du budget de population, mais l'étape 1 de la région 1 n'a que 1 à 2 de population : le groupe peut se réduire au rare seul (il n'apparaît qu'après 10 victoires).
8. Le **rang** est stocké par troupe ; la spec combat prévoyait un placement par unité.
9. `unlocked` n'a plus d'effet de jeu depuis la règle de voyage.
10. La sauvegarde stocke le **journal complet du dernier combat** (plusieurs centaines de kilo-octets possibles) : en ligne, le journal doit vivre dans une table de combats, pas dans l'état du joueur.

---

Pour regénérer l'annexe après un changement de contenu : `npx esbuild multijoueur/outils/genere-annexe.ts --bundle --platform=node --outfile=/tmp/annexe.js && node /tmp/annexe.js multijoueur/annexe-contenu.md` (depuis le dossier partagé, avec esbuild installé).

---
---

# Partie II : le jeu multijoueur cible

Cette partie décrit le jeu que Xavier veut construire en ligne (échanges du 3 novembre 2026). Elle **modifie** la partie I : quand une règle de la partie II contredit la partie I, c'est la partie II qui s'applique au jeu en ligne. Tout ce que la partie II ne mentionne pas reste tel que décrit en partie I.

Notations : **[Xavier]** = demandé par Xavier ; **[H]** = valeur ou détail que j'ai choisi pour compléter, à valider ou régler.

Contenu détaillé de la partie II :
- [contenu-cible-monde.md](/mnt/project-files/multijoueur/contenu-cible-monde.md) : les 20 régions, les 29 routes avec leurs étapes, gardiens, monstres rares et donjons, les nouveaux matériaux.
- [contenu-cible-unites.md](/mnt/project-files/multijoueur/contenu-cible-unites.md) : gabarits de stats, nouveaux sorts, troupes recrutables et leurs évolutions, monstres, monstres et boss de donjon, équipement, consommables.

## 17. Résumé des changements

| Domaine | Partie I (prototype) | Jeu en ligne |
|---|---|---|
| Joueurs | Un seul, dans le navigateur | Comptes en ligne, serveur autoritaire |
| Monde | 5 régions en ligne droite | **20 régions** en graphe, chacune reliée à 2 ou 3 autres par une route [Xavier] |
| Départ | Havre-Gris | Havre-Gris, point de départ unique pour l'instant [Xavier] |
| Stats offensives | Une attaque unique | **5 puissances** : Force, Élémentaire, Esprit, Foi, Ombre [Xavier, choix des 5 : H] |
| Défense | Résistances en % plafonnées | Inchangé, plus des **immunités** de monstres, règle à part [Xavier] |
| Soins et potions | En % des PV max | **Valeurs fixes** (plus la Foi pour les sorts) [Xavier] |
| Escouade | 5 emplacements, 5 de population | **8 emplacements, 11 de population** [Xavier] |
| Commerce | Marchand PNJ seulement | **Boutique de joueurs par ville** + marchand PNJ [Xavier] |
| Donjons | Aucun | **Portes de donjon** sur certaines routes, salles infinies, duo possible [Xavier] |
| Temple | Soin gratuit à la demande | Supprimé : **soin automatique** dès qu'on est en ville [Xavier] |
| Social | Aucun | **Chat par région**, messages privés, amis [Xavier] |
| Stratégies | Règles si / alors éditables par troupe | **Plus d'éditeur** : stratégie par défaut de la forme, le joueur peut **désactiver des capacités** [Xavier] |
| Évolutions | Absentes | **Évolutions aux niveaux 10 et 20** pour toutes les troupes [Xavier] |
| Contenu | 40 troupes, 57 monstres, 92 capacités | Ajout de 90 troupes, 228 monstres (120 de bestiaire, 24 gardiens, 84 de donjon), 60 capacités, 15 régions de matériaux et d'équipement [Xavier] |
| Niveau maximal | 30 | 30 [Xavier] |

## 18. Monde en graphe [Xavier]

### 18.1 Structure

- **20 régions**, chacune avec une ville et ses services. Les 5 régions actuelles sont gardées.
- Une **route** relie deux régions. C'est un territoire de 5 étapes, gardien à la 5e, exactement comme un territoire de la partie I. Chaque région a 2 ou 3 routes. Il y a **29 routes** (les 5 territoires actuels en font partie).
- Les règles de déplacement de la section 3.3 s'appliquent à chaque route, dans les deux sens : étapes toujours dans le même ordre, gardien au bout, arrivée seulement après avoir dégagé la dernière étape, retour possible à tout moment vers la ville de départ.
- Depuis une ville, le joueur choisit la route à prendre parmi celles de la région.

### 18.2 Paliers et niveaux [H]

L'équipement garde ses 5 paliers et le niveau maximal reste 30, donc les 20 régions se répartissent en **5 paliers de 4 régions** :

| Palier | Niveau minimal | Régions |
|---|---|---|
| 1 | 1 | Havre-Gris, Val-Moussu, Saulnes, Fort-Bruyère |
| 2 | 6 | Port-Salant, Brumefosse, Corbeval, Ambrerive |
| 3 | 11 | Rochecreuse, Givrecime, Lanterne-Noire, Braise-Haute |
| 4 | 16 | Cendrelune, Port-Corsaire, Verdeloin, Kharak |
| 5 | 21 | Sanctuaire de l'Aube, Ys-la-Profonde, Citadelle d'Obsidienne, Lune-Dormante |

- **Palier d'une route** = le plus petit des paliers de ses deux régions. Ses étapes suivent la formule de la section 3.2 avec le niveau minimal de ce palier.
- Une route entre deux paliers est la « porte » du palier suivant : comme aujourd'hui, la Forêt des Ronces (palier 1) mène à Port-Salant (palier 2).
- Le renfort des monstres (section 6.2) est indexé sur le palier de la route.
- Le graphe, la liste des routes et leurs étapes sont dans `contenu-cible-monde.md`.

### 18.3 Contenu d'une région

Chaque région nouvelle apporte : un thème, une ville (8 types recrutables, dont 6 nouveaux et 2 repris d'une autre ville du même palier ou du palier précédent [H]), un marchand, un **bestiaire** de 8 monstres, 4 matériaux et 1 composant rare propres. Une route tire ses monstres dans les bestiaires de ses deux régions, a son propre gardien (qui laisse un composant de gardien), ses 4 monstres rares et, sur 12 routes, un donjon.

Une même troupe peut se recruter dans plusieurs villes ; on rachète ses unités manquantes (et on la fait évoluer) dans n'importe quelle ville qui la recrute [H].

## 19. Statistiques étoffées

### 19.1 Les 5 puissances [Xavier, choix : H]

L'attaque unique est remplacée par 5 puissances. Chaque troupe et chaque monstre a une valeur de base et une croissance par niveau pour chacune.

| Puissance | Abrév. | Sert à | Types de dégâts habituels |
|---|---|---|---|
| Force | FOR | Armes et techniques d'arme, charges, coups | contondant, tranchant (et le type de l'arme) |
| Élémentaire | ÉLÉ | Magie du feu et de la glace | feu, glace |
| Esprit | ESP | Sorts mentaux, peur, confusion, contrôle | psychique |
| Foi | FOI | Magie sacrée, **soins**, boucliers, bénédictions | sacré |
| Ombre | OMB | Magie noire, malédictions, poisons, drains | ténèbres, maladie |

- **Chaque capacité déclare sa puissance et son type de dégâts séparément** [Xavier] : Lame d'ombre utilise la Force mais inflige des ténèbres ; Flèche enflammée utilise la Force et inflige du feu ; Boule de feu utilise l'Élémentaire. Le tableau de correspondance des 92 capacités actuelles et la définition des 60 nouvelles sont dans `contenu-cible-unites.md`.
- Une capacité a aussi un **coefficient** de puissance `coef` (‰, défaut 1 000).
- Cri de guerre, Chant de guerre (+ ‰) et Affaibli (− ‰) modifient toutes les puissances. Rage modifie la Force.

### 19.2 Formules

```
Puissance effective = floor(puissance × max(0, 1000 + bonus − malus) / 1000)

Capacité d'arme  : brut = floor(dégâts de l'arme × mult / 1000) + floor(puissance × coef / 1000)
Sort de dégâts   : brut = dégâts de base + floor(puissance × coef / 1000)
Soin (sort)      : soin = soin de base + floor(FOI × coef / 1000), puis × healMult
Bouclier (sort)  : absorption = base + floor(FOI × coef / 1000)
Régénération     : par tic = base + floor(FOI × coef / 1000)
```

Avec `coef = 1 000` et une puissance égale à l'ancienne attaque, ces formules donnent exactement les dégâts actuels : la migration du contenu existant est neutre. Les nouvelles capacités utilisent des coefficients plus forts (jusqu'à 3 000) pour que la puissance compte vraiment.

### 19.3 Migration du contenu existant [H]

Pour les 40 troupes et 57 monstres de la partie I : la **puissance principale** reprend l'ancienne attaque (base et croissance) ; elle est donnée par le gabarit du type (Force pour les combattants et tireurs, Élémentaire pour les pyromanciens et mages de glace, Foi pour les prêtres, Ombre pour les adeptes et sorcières, Esprit pour les moines et oracles). Les **puissances secondaires** prévues par le gabarit valent la moitié, les autres 20 % (arrondis à l'inférieur, au moins 0).

### 19.4 Résistances et immunités [Xavier]

- Les résistances restent des pourcentages par type, bornées à **+75 %** et −100 % (inchangé).
- **Immunité** : règle spéciale, réservée aux monstres [H]. Un monstre immunisé contre un type :
  - subit **0** dégât de ce type (la règle « au moins 1 dégât » ne s'applique pas) ; aucune capacité, aucun bonus, ni Tir précis, ni Marque, ni Brise-armure, ni Malédiction ne contourne une immunité ;
  - ne reçoit pas l'état de dégâts sur la durée associé : feu → Brûlure, maladie → Poison, tranchant → Saignement ; glace → aussi insensible au Gel (le Ralenti s'applique) ; psychique → aussi insensible à la Confusion et aux pertes de volonté causées par une capacité psychique ;
  - affiche son immunité dans l'aperçu de la rencontre et dans le Codex.
- Une attaque ne choisit **pas une cible immunisée** à son type s'il existe une autre cible valide [H] ; nouvelle condition de règle `targetImmune` / `targetNotImmune` pour l'écrire explicitement.
- Le test « combat bloqué » ne compte pas les attaques qui ne visent que des immunisés : une escouade qui ne peut rien blesser avance, puis perd à la durée limite.
- Les gardiens, boss et monstres élémentaires portent la plupart des immunités ; jamais plus de 2 types par monstre, jamais les deux types physiques à la fois [H].

### 19.5 Soins et potions en valeurs fixes [Xavier]

Plus aucun soin ne dépend des PV max de la cible.
- Sorts de soin : valeur de base + Foi (formules 19.2). Valeurs dans `contenu-cible-unites.md` (exemple : Soin mineur 40 + 4 × FOI, Soin majeur 90 + 8 × FOI, Cercle de soins 30 + 3 × FOI à chaque allié).
- Les recharges par cible (60 et 100 instants) et `healMult` = 1,2 sont gardés.
- Drain : rend la moitié des dégâts infligés (inchangé).
- **Consommables** : PV et mana fixes.

| Objet | Effet | Palier |
|---|---|---|
| Bandage | +50 PV | 1 |
| Potion de soin mineure | +100 PV | 1 |
| Potion de mana mineure | +40 mana | 1 |
| Potion de soin | +220 PV | 2 |
| Potion de mana | +90 mana | 2 |
| Potion de soin majeure | +450 PV | 3 |
| Tonique | +150 PV et +50 mana | 3 |
| Élixir de vigueur (nouveau) | +800 PV | 4 |
| Potion de mana supérieure (nouveau) | +160 mana | 4 |
| Onguent de remise | +1 200 PV | 5 |
| Panacée (nouveau, donjon seulement) | +1 500 PV et +150 mana | 5 |

### 19.6 Équipement

Les pools de stats des bases gagnent les 5 puissances (coût : 1 point de budget = 1 de puissance, comme l'ancienne attaque) ; l'ancienne stat « attaque » d'un exemplaire existant devient la puissance principale de la catégorie (Force pour les armes physiques, Élémentaire pour les bâtons, Foi pour les sceptres et talismans…). Deux catégories nouvelles : **orbe** (arme une main des lanceurs de sorts, Élémentaire et Ombre) et **talisman** (accessoire, Foi et Esprit). Chaque région nouvelle a une base d'équipement signature, chaque donjon deux bases uniques. Détail dans `contenu-cible-unites.md`.

## 20. Escouade : 8 emplacements, 11 de population [Xavier]

- Escouade : **8 unités au plus et 11 points de population au plus**. Le reste des règles 4.5 est inchangé (caserne illimitée, engagement en ville).
- Les groupes de monstres sont dimensionnés en conséquence [H] : population des étapes **× 2** (arrondi), limite de **8 emplacements** par groupe de monstres. Exemple : étape 1 de la Forêt des Ronces 2 à 4 de population au lieu de 1 à 2 ; gardien 16 à 18 avec son escorte, gardien compris.
- XP : la formule ne change pas, mais comme l'XP n'est pas partagée (section 16, point 3), une escouade plus grosse gagne plus d'XP au total. **À trancher** : je propose de diviser l'XP de base par le nombre de troupes gagnantes multiplié par 0,4 au moins [H, non appliqué tant que Xavier n'a pas choisi].
- L'équilibrage mesuré en section 15 est à refaire entièrement.

### 20.1 Stratégies : pas d'éditeur, des sorts désactivables [Xavier]

- Le joueur **ne paramètre plus les stratégies** : la liste de règles si / alors (section 4.7) n'est plus éditable. Chaque troupe joue la **stratégie par défaut de sa forme**, définie dans le contenu (section 5.6 et annexe E) [Xavier].
- Le joueur peut **désactiver des capacités** pour une troupe : une capacité désactivée n'est jamais utilisée au combat, et les règles qui la lancent sont ignorées [Xavier].
- Précisions [H] :
  - l'attaque de base ne peut pas être désactivée (une troupe a toujours une action) ;
  - les passifs se désactivent comme les autres capacités ;
  - le plafond de 6 capacités actives reste : parmi les capacités connues et non désactivées, l'attaque de base plus les 5 plus récemment apprises ;
  - une capacité apprise plus tard (niveau, évolution) est active d'office, sauf si le joueur la désactive ;
  - le réglage est par troupe, s'applique à toutes ses unités, se modifie en ville et en expédition entre deux combats, et suit la troupe vendue en boutique.
- Conséquence pour le contenu : les stratégies par défaut doivent être bonnes, puisque le joueur ne peut plus les corriger. Elles sont testées par la simulation d'équilibrage, et chaque forme d'évolution reçoit sa propre stratégie par défaut, générée par `ia.ts` puis relue.

## 21. Soins en ville [Xavier]

- Le temple disparaît.
- **Toute entrée en ville** (arrivée au bout d'une route, retour volontaire, repli forcé après une défaite, sortie de donjon par défaite) remet **toutes les troupes** du joueur à PV et mana maximum.
- En ville, une troupe est donc toujours à pleine vie. Si une unité change d'équipement en ville et que son maximum change, elle est aussitôt remise au maximum.
- En expédition, changer d'équipement ne soigne pas (PV et mana gardés, bornés au nouveau maximum) [H : lecture de « si une troupe change d'objets, elle est immédiatement soignée » limitée à la ville, sinon un échange d'objet soignerait gratuitement en route].

## 22. Boutiques des joueurs [Xavier]

### 22.1 Principe

- Chaque ville a sa **boutique** : une liste d'annonces de joueurs. Une annonce n'est visible et achetable **que dans la ville où elle a été posée**. Les boutiques de deux villes sont donc deux marchés séparés, avec leurs propres prix.
- On peut vendre une **pile d'objets** (quantité au choix), un **exemplaire d'équipement** ou une **troupe** (avec son niveau, son XP, sa forme, ses unités vivantes, leur équipement et ses PV pleins).
- Le vendeur fixe un **prix en or**. L'acheteur doit être **dans la ville** de la boutique.
- Le **marchand PNJ** reste (vente et rachat à prix fixe, section 8.3).

### 22.2 Règles [H sauf mention]

- **Poser une annonce** : en ville ; le bien vient de la banque (ou de la caserne pour une troupe, qui ne doit pas être engagée). Il passe en **séquestre** : il n'est plus dans la banque, ne peut être ni utilisé ni vendu ailleurs.
- **Taxe** : 5 % du prix, prélevée sur le vendeur à la vente (puits d'or). Pas de frais de dépôt. Prix minimal : le prix de rachat PNJ (évite le blanchiment d'or entre comptes à 1 or).
- **Durée** : 7 jours. Ensuite l'annonce expire et le bien retourne à la banque du vendeur (une troupe à sa caserne).
- **Retirer une annonce** : dans la ville de l'annonce seulement.
- **Achat** : immédiat, au prix affiché, transaction atomique ; l'objet arrive dans la banque de l'acheteur, la troupe dans sa caserne ; l'or (moins la taxe) est versé au vendeur même s'il est hors ligne, avec une notification.
- **Limites** : 20 annonces actives par joueur ; comptes de moins de 24 heures ou de niveau d'escouade faible : pas de vente de troupes (anti multi-comptes).
- Bien non vendable : la troupe prêtée par la garde. Les trophées se vendent (c'est voulu : on peut acheter de quoi rendre une quête).
- **Recherche** : par nom, famille, palier, emplacement, prix ; tri par prix. Historique des 20 dernières ventes de chaque objet dans la ville (prix moyen affiché).
- Les matériaux « réservés à l'échange » (section 8.5) et les recettes personnelles sont le moteur de ce commerce : ce qui est inutile à l'un est un ingrédient pour un autre.

### 22.3 Exigences techniques

Chaque bien n'existe qu'à un seul endroit (banque, sac, caserne, escouade, unité, séquestre d'annonce, coffre de donjon). Toute vente passe par un service de transfert unique, journalisé, et l'or par un grand livre en partie double (architecture A6, A7). Achat simultané d'une même annonce par deux joueurs : un seul réussit.

## 23. Donjons [Xavier]

### 23.1 Où et quand

- **12 routes sur 29** ont un donjon, chacun propre à sa route (thème, monstres, boss, objets). Liste dans `contenu-cible-monde.md`.
- Sur ces routes, chaque **changement d'étape** (avancer, rebrousser, et la première étape au départ) a **2 % de chances** de faire apparaître une **porte de donjon** sur l'étape d'arrivée [Xavier]. Tirage serveur.
- La porte reste visible tant que le joueur est sur cette étape ; elle disparaît s'il la quitte [H]. On peut l'**ignorer** (rien ne se passe) ou l'**ouvrir** à tout moment pendant qu'on est sur l'étape, hors rediffusion.

### 23.2 Entrer seul ou à deux

À l'ouverture, le joueur choisit :
- **Seul** ;
- **Inviter un ami** : un joueur de sa liste d'amis qui est **dans la même région** [Xavier] ;
- **Inviter un joueur au hasard** : la proposition est envoyée aux joueurs de la même région qui se sont déclarés « disponibles pour un donjon » ; le premier qui accepte rejoint [Xavier pour le principe, H pour le mécanisme].

Précisions [H] :
- « Dans la même région » : le joueur est dans la ville de la région, ou sur une route qu'il a prise depuis cette ville.
- L'invité doit être hors combat et hors rediffusion. Il a 60 secondes pour accepter. Il rejoint avec son escouade dans l'état où elle est (PV, mana, sac).
- À la sortie du donjon, chacun retourne là où il était avant (l'ouvreur sur son étape, l'invité dans sa ville ou sur son étape).

### 23.3 Combat en duo [Xavier]

- Les deux escouades combattent ensemble dans le même camp : **16 emplacements, 22 de population**. Les unités de l'ouvreur occupent les premiers emplacements.
- Chaque troupe garde ses capacités désactivées (section 20.1). Les unités des deux joueurs sont alliées pour toutes les règles (soins, zones alliées, morts d'alliés).
- Le groupe de monstres est dimensionné pour deux escouades : population × 2, limite de 16 emplacements [H].
- **Chacun garde ses troupes, ses morts et son butin** [Xavier] : l'XP est calculée par troupe comme d'habitude ; chaque joueur tire son propre butin et son propre or sur les tables du donjon.
- La rediffusion est obligatoire pour les deux.

### 23.4 Salles

- Le donjon a des **salles infinies** numérotées 1, 2, 3… [Xavier]. Chaque salle est un combat.
- Après chaque victoire : **salle suivante** ou **quitter le donjon** [Xavier]. En duo, la salle suivante demande l'accord des deux ; si l'un quitte, il sort avec son butin et l'autre peut continuer seul (le groupe suivant redevient dimensionné pour une escouade) [H].
- **Les PV persistent de salle en salle** [Xavier] ; le mana regagne 25 % à la fin de chaque combat (comme ailleurs) ; les consommables du sac sont utilisables entre deux salles ; pas de soin automatique.
- **Un boss toutes les 4 salles** [Xavier] (salles 4, 8, 12…). Chaque donjon a 3 boss qui se succèdent dans l'ordre (salle 4 : boss 1, salle 8 : boss 2, salle 12 : boss 3, salle 16 : boss 1 de nouveau, plus fort, etc.).

### 23.5 Difficulté croissante [Xavier, formules H]

Pour une route de palier T (niveau minimal L) et la salle n :
```
Niveau des monstres  = min(30, L + 2 + floor((n − 1) / 2))
Surpuissance         = au-delà du niveau 30 : PV et puissances × (1 + 0,06 × (L + 2 + floor((n − 1) / 2) − 30))
Population du groupe = min(3 + n, 11) en solo (min(6 + 2n, 22) en duo), boss compris
Renfort de région    = celui du palier T (section 6.2)
```
Les monstres d'une salle sont tirés dans le pool du donjon (4 monstres spéciaux), le boss est imposé dans les salles de boss.

### 23.6 Butin de donjon

- Chaque salle gagnée donne de l'or (`10 × T² × (1 + n/4)`) et 2 tirages sur la table du donjon : matériaux du donjon et des régions de la route (70 %), composants (12 %), consommables dont la Panacée (10 %), équipement (8 %, jet de puissance +10 ‰ par salle, plafonné à 1 400). [H]
- Un boss laisse toujours son **trophée de boss** et un tirage garanti sur les **objets uniques** du donjon (2 bases d'équipement non fabricables par donjon, 25 %) ou un composant.
- Le butin gagné dans le donjon est gardé dans un **coffre du donjon**, à part du sac.
  - **Quitter** : le coffre est livré dans la **banque** du joueur [H] (pas de limite de sac).
  - **Défaite** : **tout le coffre est perdu** [Xavier] ; les unités mortes sont mortes ; le joueur est renvoyé dans la ville de sa région, où ses troupes sont soignées.
- Les morts sont définitives dans le donjon comme ailleurs.

### 23.7 Quêtes de donjon [Xavier]

Certaines quêtes demandent des **trophées de boss de donjon**. Le générateur de quêtes (section 9.2) gagne une 4e sorte de demande pour les villes reliées à une route à donjon : 20 % des quêtes de ces villes demandent 1 trophée d'un boss (le boss précis est tiré parmi les 3 du donjon), avec une récompense tirée comme une quête « troupe » ou « équipement » et une prime d'or × 2 [H].

## 24. Évolutions des troupes [Xavier]

- Chaque type recrutable a des **formes** : la forme de départ, une **évolution au niveau 10**, et une **évolution au niveau 20**, qui propose souvent **deux branches au choix, définitif**.
- L'évolution est **facultative** : la troupe continue de monter de niveau sans évoluer, mais n'apprend pas les capacités des formes suivantes.
- Elle se fait **en ville**, dans une ville qui recrute ce type [H], contre une **recette personnelle** (matériaux, or et, au niveau 20, un composant) [H] :
  - niveau 10 : ingrédients d'une valeur de 2 × la recette de recrutement, or = 60 × population × palier de la troupe ;
  - niveau 20 : 4 × la recette de recrutement + 1 composant de palier ≥ 3, or = 200 × population × palier.
- Effet : la forme apporte un multiplicateur de PV, des bonus de volonté, d'énergie, de mana et de puissances, parfois une vitesse ou des résistances nouvelles, et de nouvelles capacités apprises à des niveaux donnés. La troupe garde niveau, XP et unités ; l'équipement qui ne correspond plus aux catégories de la nouvelle forme retourne en banque.
- Capacités désactivées : gardées ; les nouvelles capacités de la forme sont actives d'office, désactivables (section 20.1) [H].
- Gabarits de bonus et liste des évolutions de chaque type : `contenu-cible-unites.md`. Les 10 troupes du banc d'essai gardent les formes déjà écrites dans `content.ts`.
- Les monstres n'évoluent pas.

## 25. Social : chat, messages privés, amis [Xavier]

- **Un canal de discussion par région** [Xavier] : un joueur lit et écrit dans le canal de la région où il se trouve (ville, ou route prise depuis cette ville). Pas de canal global [Xavier].
- **Messages privés** entre deux joueurs, par pseudo, livrés même hors ligne [Xavier].
- **Liste d'amis** (nécessaire pour inviter un ami en donjon) : demande et acceptation, statut en ligne, région actuelle visible des amis [H].
- Modération [H] : bloquer un joueur, signaler un message, limite de 1 message par seconde et 20 par minute, filtre de mots, historique des canaux de 7 jours, outils d'administration (rendre muet, bannir).
- Liens dans le chat [H] : on peut citer un objet, une troupe ou une annonce de boutique (fiche consultable).

## 26. Comptes et présence [H]

- Compte : pseudo unique, connexion, une seule partie par compte.
- La graine du joueur est tirée par le serveur à la création et ne quitte jamais le serveur.
- Position d'un joueur : ville, ou route + sens + étape, ou donjon + salle. Elle sert au chat, aux invitations, aux boutiques.
- Un joueur déconnecté en expédition y reste ; en donjon duo, une absence de plus de 5 minutes vaut « quitter » (avec son butin).

## 27. Liste des points encore ouverts

1. ~~Partage ou non de l'XP entre les troupes d'une escouade de 8 (section 20).~~ Tranché par Xavier le 3 novembre 2026 : l'XP est partagée entre les troupes de l'escouade (règle de répartition à fixer avec la progression, J3).
2. Durée minimale de rediffusion imposée par le serveur (section 13.1).
3. Les 12 routes à donjon proposées et la formule de difficulté des salles (section 23.5).
4. Taxe de 5 %, durée de 7 jours et limite de 20 annonces des boutiques (section 22.2).
5. Coûts des évolutions (section 24).
6. Soin au changement d'équipement limité à la ville (section 21).
