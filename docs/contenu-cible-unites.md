# Contenu cible : stats, capacités, troupes, évolutions, monstres, équipement

Complément de la partie II du [README](/mnt/project-files/multijoueur/README-jeu.md) (sections 19, 23 et 24) et de [contenu-cible-monde.md](/mnt/project-files/multijoueur/contenu-cible-monde.md). Tout le contenu nouveau est une proposition [H] à régler à l'équilibrage ; les noms et les rôles sont faits pour être relus par Xavier.

Abréviations des puissances : **FOR** Force, **ÉLÉ** Élémentaire, **ESP** Esprit, **FOI** Foi, **OMB** Ombre. Jauges : PV, VOL (volonté), ÉN (énergie), MANA. Les PV, l'énergie et le mana sont ensuite multipliés par 3 (`GAUGE_MULT`, README 4.2).

---

## 1. Gabarits de statistiques

Pour garder 300 types cohérents, chaque troupe et chaque monstre nouveau part d'un **gabarit** (stats d'une unité de population 1 au niveau 1, et croissance par niveau), puis applique le facteur de taille et ses propres retouches.

| Gabarit | Rôle | PV | VOL | ÉN | MANA | FOR | ÉLÉ | ESP | FOI | OMB | Vitesse | Croissance (PV/VOL/ÉN/MANA · FOR/ÉLÉ/ESP/FOI/OMB) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REM | rempart, contact | 110 | 65 | 100 | 0 | 5 | 0 | 1 | 1 | 0 | 20 | 7/1/2/0 · 1/0/0,3/0,3/0 |
| BRE | bretteur, contact rapide | 80 | 55 | 100 | 0 | 6 | 0 | 1 | 0 | 1 | 16 | 4/1/2/0 · 1,5/0/0,3/0/0,3 |
| BRU | brute, contact lent | 140 | 50 | 110 | 0 | 8 | 0 | 0 | 0 | 0 | 25 | 9/1/2/0 · 2/0/0/0/0 |
| TIR | tireur | 70 | 55 | 95 | 0 | 5 | 0 | 1 | 0 | 0 | 18 | 4/1/2/0 · 1,3/0/0,3/0/0 |
| MAG | mage élémentaire | 65 | 60 | 70 | 50 | 1 | 6 | 2 | 0 | 0 | 23 | 3/1/1/3 · 0,3/1,5/0,5/0/0 |
| PRE | prêtre, soin | 70 | 80 | 80 | 45 | 2 | 0 | 2 | 6 | 0 | 22 | 4/2/1/2,5 · 0,5/0/0,5/1,5/0 |
| OCC | occultiste | 65 | 65 | 70 | 45 | 1 | 0 | 2 | 0 | 6 | 23 | 3/2/1/2,5 · 0,3/0/0,5/0/1,5 |
| MYS | mystique, esprit | 75 | 95 | 90 | 30 | 3 | 0 | 6 | 0 | 0 | 18 | 4/3/2/1,5 · 0,5/0/1,5/0/0 |
| BET | bête | 70 | 50 | 100 | 0 | 5 | 0 | 0 | 0 | 0 | 15 | 4/1/2/0 · 1,2/0/0/0/0 |
| ELM | élémentaire (immunité de son élément) | 90 | 99 | 80 | 40 | 3 | 5 | 0 | 0 | 0 | 21 | 5/0/1/2 · 0,5/1,3/0/0/0 |
| CON | construct (golem, idole) | 150 | 99 | 100 | 0 | 6 | 0 | 0 | 0 | 0 | 26 | 9/0/2/0 · 1,5/0/0/0/0 |
| GAR | gardien de route | 450 | 99 | 150 | 80 | 10 | 6 | 6 | 6 | 6 | 22 | 14/2/2/2 · 2/1,5/1,5/1,5/1,5 |
| BOS | boss de donjon | 550 | 99 | 160 | 100 | 11 | 7 | 7 | 7 | 7 | 21 | 16/2/2/3 · 2,2/1,8/1,8/1,8/1,8 |

**Facteur de taille** : avec `f = population ÷ nombre d'unités`, chaque unité a `PV × (0,55 + 0,45 f)` et `puissances × (0,8 + 0,2 f)` ; volonté, énergie, mana et vitesse inchangés. Exemples : 1 unité de 2 pop. → PV ×1,45, puissances ×1,2 ; 1 unité de 3 pop. → ×1,9 et ×1,4 ; 3 unités de 2 pop. → ×0,85 et ×0,93 chacune.

**Retouches** : chaque entrée peut ajouter `PV+x %`, `vit ±n`, `FOR+n`, etc. Les puissances qui valent 0 restent à 0 (pas de croissance).

Gardiens et boss : PV et puissances déjà donnés pour leur population (pas de facteur de taille), population indiquée seulement pour le budget de la rencontre.

---

## 2. Puissance des 92 capacités existantes

Règle générale : capacités d'arme (dégâts d'arme, `wdmg`, Riposte, Charge, Séisme, Tourbillon…) → **FOR** ; sorts de feu et de glace → **ÉLÉ** ; sorts psychiques, peur, confusion, silence → **ESP** ; sacré, soins, boucliers, bénédictions, Garde, Régénération → **FOI** ; ténèbres, maladie, malédictions, drains, poisons de sort → **OMB**. Coefficient 1 000 (identique au prototype).

Exceptions : Flèche de givre, Flèche enflammée, Tir empoisonné, Morsure venimeuse, Lame d'ombre, Lame saignante, Souffle de feu (monstres, énergie) → FOR ; Paume du vide → ESP ; Arme enflammée → ÉLÉ du lanceur ; Hurlement, Cri de guerre, Chant de guerre → ESP pour la volonté (le bonus de puissance reste en ‰).

Soins et boucliers passés en **valeurs fixes** (README 19.5) :

| Capacité | Avant | Maintenant |
|---|---|---|
| Soin mineur | +25 % PV max (DE 10 %, EC −10 %) | +40 + 4 × FOI (DE moitié, EC inflige 20 à la cible) |
| Soin majeur | +45 % | +90 + 8 × FOI |
| Prière collective | +10 % à tous | +25 + 2,5 × FOI à tous |
| Cercle de soins | +18 % à tous | +30 + 3 × FOI à tous |
| Régénération | +3 % par tic, 5 tics | +5 + 0,6 × FOI par tic |
| Sève régénératrice | +4 % par tic | +6 + 0,8 × FOI par tic |
| Second souffle | +30 % énergie, +8 % PV | +30 % énergie, +20 + 2 × ESP PV |
| Bouclier de foi | 40 (DE 15) | 30 + 5 × FOI (DE moitié) |
| Mur de boucliers | 25 au rang | 20 + 2 × FOR au rang |
| Consommables | en % | valeurs fixes, README 19.5 |

---

## 3. Nouvelles capacités (60 : 54 actives et 6 passifs)

Format : **id** Nom · puissance (coef ‰) · cible et portée · coût · durée (multiplicateur de la vitesse) · effet. DE = demi-échec, EC = échec critique ; sans mention, la règle générique des sorts `fx` s'applique (README 5.10).

### 3.1 Force

- **frappe_brutale** Frappe brutale · FOR (1 500) · ennemi 1 · 25 én · arme ×1,5 · arme ×1,6 contondant, retire la Garde de la cible.
- **enchainement** Enchaînement · FOR (800) · ennemi 1 · 20 én · arme ×1,5 · deux coups à ×0,8 sur la même cible.
- **brise_genou** Brise-genou · FOR · ennemi 1 · 18 én · arme · arme ×0,9 et Ralenti 60.
- **taillade** Taillade large · FOR (800) · ennemi 1 · 25 én · arme ×2 · arme ×0,8 à tout le rang de la cible.
- **estoc** Estoc perforant · FOR (1 300) · ennemi 1 · 20 én · arme ×1,5 · arme ×1,3, ignore 50 % des résistances.
- **bond** Bond du prédateur · FOR (1 200) · ennemi 2-3 · 22 én · ×1,5 · avance au rang 1, arme ×1,2 et Étourdi 10.
- **rempart_vivant** Rempart vivant · FOI (−) · soi · 25 én · ×2 · Garde +30 % 80 instants et Provocation 60.
- **cri_defi** Cri de défi · ESP · soi · 15 én · ×1 · Provocation 60 et +10 % de volonté.
- **rafale** Rafale · FOR (500) · ennemi 4 · 25 én · arme ×2 · 3 tirs à ×0,5 sur des ennemis au hasard à portée.
- **carreau_lourd** Carreau lourd · FOR (1 800) · ennemi 5 · 22 én · arme ×2 · arme ×1,8 et Étourdi 15.
- **filet** Filet lesté · FOR · ennemi 3 · 15 én · ×1 · Ralenti 80 et attire d'un rang.
- **coup_assommant** Coup assommant · FOR · ennemi 1 · 20 én · arme ×1,5 · arme ×0,7 contondant et Étourdi 25.
- **laceration** Lacération · FOR · ennemi 1 · 12 én · arme · arme ×0,8 et Saignement 6 (cumulable 3).
- **pietinement** Piétinement · FOR (700) · soi · 30 én · ×2 · arme ×0,7 contondant aux ennemis des rangs 1-2, Étourdi 10 au contact.
- **lame_ardente** Lame ardente · FOR (1 100) · ennemi 1 · 18 én · arme · arme ×1,1 en feu et Brûlure 5.
- **harpon_tir** Harpon · FOR · ennemi 3 · 18 én · arme · arme ×1 et attire de deux rangs.

### 3.2 Élémentaire

- **javelot_glace** Javelot de glace · ÉLÉ (1 500) · ennemi 5 · 12 mana · ×1 · 22 glace et Ralenti 40.
- **blizzard** Blizzard · ÉLÉ (800) · ennemi 5 · 26 mana · ×2,5 · 12 glace et Ralenti 40 à tous les ennemis.
- **prison_glace** Prison de glace · ÉLÉ · ennemi 5 · 18 mana · ×2 · Gelé 25 (même règle d'immunité au regel que Flèche de givre).
- **lance_feu** Lance de feu · ÉLÉ (1 500) · ennemi 5 · 14 mana · ×1 · 28 feu.
- **nova_flammes** Nova de flammes · ÉLÉ · soi · 18 mana · ×2 · 16 feu et Brûlure 5 aux ennemis des rangs 1-2.
- **meteore** Météore · ÉLÉ (2 000) · ennemi 5 · 32 mana · ×3 · 40 feu à tout un rang et Brûlure 6.
- **armure_givre** Armure de givre · ÉLÉ · allié 2 · 12 mana · ×1 · Garde +20 % et Épines 5, 80 instants.
- **bouclier_flammes** Bouclier de flammes · ÉLÉ (3 000) · soi · 14 mana · ×1 · Bouclier 20 + 3 × ÉLÉ et Épines 8, 80 instants.
- **souffle_glacial** Souffle glacial · ÉLÉ · ennemi 2 · 30 én · ×2 · 18 glace et Ralenti 60 à un rang (monstres).
- **jet_magma** Jet de magma · ÉLÉ (1 200) · ennemi 4 · 14 mana · ×1,5 · 20 feu et repousse d'un rang.

### 3.3 Esprit

- **onde_mentale** Onde mentale · ESP (1 200) · ennemi 5 · 14 mana · ×2 · 14 psychique et −10 % de volonté à tout un rang.
- **domination** Domination · ESP · ennemi 5 · 16 mana · ×2 · Confusion et −25 % de volonté.
- **vision_terreur** Vision de terreur · ESP · ennemi 5 · 12 mana · ×1 · 10 psychique et −30 % de volonté.
- **lame_psychique** Lame psychique · ESP (1 800) · ennemi 3 · 12 mana · ×1 · 20 psychique.
- **sommeil** Sommeil · ESP · ennemi 5 · 18 mana · ×2 · Étourdi 40 ; sans effet sur les immunisés au psychique.
- **clarte** Clarté · ESP · allié 3 · 10 mana · ×1 · +25 % de volonté et retire la Confusion.
- **concentration** Concentration · ESP · soi · 10 én · ×2 · +30 % de volonté et +20 % du mana max.
- **hurlement_mental** Hurlement mental · ESP · soi · 22 mana · ×2 · 8 psychique et −15 % de volonté à tous les ennemis.
- **mirage** Mirage · ESP · soi · 20 én · ×1 · Garde +40 % pendant 40 instants.
- **lien_esprits** Lien des esprits · ESP · soi · 16 mana · ×1,5 · +10 % de volonté et +10 % d'énergie à tous les alliés.

### 3.4 Foi

- **mains_lumiere** Mains de lumière · FOI · allié 2 · 14 mana · ×1 · soin 60 + 6 × FOI (soin direct, recharge 60).
- **onde_soin** Onde de soin · FOI · soi · 18 mana · ×2 · soin 35 + 3,5 × FOI aux alliés de son rang (soin direct).
- **rayon_sacre** Rayon sacré · FOI (1 500) · ennemi 5 · 12 mana · ×1 · 24 sacré, ×2 contre mort-vivant et démon.
- **jugement** Jugement · FOI (2 000) · ennemi 5 · 25 mana · ×2 · 40 sacré, ×2 contre démon.
- **egide** Égide · FOI (6 000) · allié 3 · 16 mana · ×1 · Bouclier 50 + 6 × FOI, 100 instants.
- **consecration** Consécration · FOI · ennemi 5 · 20 mana · ×2 · 12 sacré et Affaibli 15 % à un rang (×2 contre mort-vivant et démon).
- **purification_masse** Purification de masse · FOI · soi · 20 mana · ×2 · retire les états négatifs de tous les alliés.
- **chatiment** Châtiment · FOI · ennemi 1 · 15 én · arme · arme ×1,1 en sacré.

### 3.5 Ombre

- **trait_ombre** Trait d'ombre · OMB (1 500) · ennemi 5 · 10 mana · ×1 · 20 ténèbres.
- **peste** Peste · OMB · ennemi 4 · 18 mana · ×2 · Poison 5 (cumulable 4) à tout un rang.
- **drain_ame** Drain d'âme · OMB (1 500) · ennemi 3 · 16 mana · ×2 · 26 ténèbres, rend la moitié.
- **malefice** Maléfice · OMB · ennemi 5 · 16 mana · ×2 · Malédiction et Affaibli 20 %, 80 instants.
- **nuee_ombres** Nuée d'ombres · OMB (800) · ennemi 5 · 24 mana · ×2,5 · 10 ténèbres à tous les ennemis.
- **putrefaction** Putréfaction · OMB · ennemi 4 · 12 mana · ×1 · 16 maladie et Poison 4.
- **pacte_sang** Pacte de sang · OMB · soi · 0 · ×1 · perd 30 PV, Cri de guerre +30 % pendant 60.
- **toucher_tombe** Toucher de la tombe · OMB · ennemi 2 · 10 mana · ×1 · 14 ténèbres et Ralenti 40.
- **marque_mort** Marque de mort · OMB · ennemi 5 · 12 mana · ×1 · 8 ténèbres et Marque (3 attaques à +30 %).
- **silence_tombe** Silence de la tombe · OMB · ennemi 5 · 22 mana · ×2 · Silence 60 à tout un rang.

### 3.6 Passifs nouveaux (le moteur doit savoir lire des passifs de stats)

- **peau_dure** Peau dure : résistance contondant et tranchant +10 %.
- **maitrise_elem** Maîtrise élémentaire : ÉLÉ +15 %.
- **ferveur** Ferveur : soins donnés +15 %.
- **sang_froid** Sang-froid : la volonté ne descend pas sous 30 %.
- **predateur** Prédateur : +20 % de dégâts sur une cible sous 50 % de PV.
- **aura_protection** Aura de protection : alliés de son rang, toutes résistances +8 %.

---

## 4. Évolutions

### 4.1 Gabarits de forme

| Code | Forme | Effet sur la forme précédente |
|---|---|---|
| E1 | évolution du niveau 10 | PV ×1,15, VOL +10, ÉN +10, MANA +10 (si lanceur), puissance principale +3, vitesse −1 |
| A | niveau 20, branche attaque | PV ×1,15, puissance principale +8, puissance secondaire +3, vitesse −1 |
| D | niveau 20, branche défense | PV ×1,35, VOL +20, résistances contondant et tranchant +10 %, vitesse +1 |
| S | niveau 20, branche soutien | PV ×1,2, VOL +20, MANA +30, puissance de soin ou de contrôle +6 |
| M | niveau 20, branche unique | PV ×1,25, VOL +15, puissance principale +5 |

Une troupe recrutée au niveau 16 ou 21 peut évoluer tout de suite, une forme après l'autre. Les capacités indiquées s'ajoutent à celles des formes précédentes, au niveau d'apprentissage indiqué (une capacité dont le niveau est déjà dépassé est apprise aussitôt).

### 4.2 Les 10 troupes du banc d'essai

Elles gardent les formes déjà écrites dans `content.ts` (annexe-contenu.md, section C) : Milicien → Fantassin (10) → Garde du rempart | Lame vétérane (20) ; Frondeurs → Tirailleurs (10) → + Frondeurs d'élite (20, M : rafale 20, carreau_lourd 25) ; Acolyte → Prêtre (10) → Haut-prêtre | Inquisiteur (20) ; Apprenti pyromancien → Pyromancien (10) → Maître des cendres (20) | + Mage de bataille (20, A : lance_feu 20, meteore 25) ; Chasseur → Traqueur des neiges (10) → + Maître-chasseur (20, A : rafale 20, predateur 24) ; Berserker → Massacreur (15) → + Seigneur de guerre (20, M : pietinement 20, cri_defi 24) ; Loups jumeaux → Loups alphas (12) → + Meute du crépuscule (20, A : bond 20, predateur 24) ; Adepte → Nécromancien (10) → Liche | Sorcier de peste (20) ; Novice → Moine (10) → Maître du souffle (20) | + Moine-esprit (20, S : clarte 20, domination 24) ; Briseur → Colosse de siège (15) → + Briseur de murailles (20, D : frappe_brutale 20, peau_dure 22).

### 4.3 Les 30 troupes ajoutées dans le prototype

Format : Type → forme E1 (capacités) → forme(s) du niveau 20 (code : capacités).

- **Écuyer** → Chevalier (E1 : cri_defi 10, coup_assommant 14) → Chevalier-banneret (D : rempart_vivant 20, aura_protection 25) | Chevalier errant (A : enchainement 20, estoc 24)
- **Herboriste** → Druidesse (E1 : mains_lumiere 10, armure_givre 14) → Gardienne des bois (S : onde_soin 20, ferveur 24) | Druidesse des ronces (M : peste 20, carapace_epines 24)
- **Braconniers** → Pisteurs (E1 : filet 10, laceration 14) → Rôdeurs (A : rafale 20, predateur 25)
- **Harponneur** → Baleinier (E1 : harpon_tir 10, estoc 14) → Chasseur de léviathans (A : carreau_lourd 20, predateur 24)
- **Sorcière des marais** → Sorcière des fanges (E1 : putrefaction 10, malefice 14) → Mère des marais (S : peste 20, silence_tombe 25) | Sorcière vampire (A : drain_ame 20, trait_ombre 22)
- **Gardes de la marée** → Gardes des digues (E1 : cri_defi 10, coup_assommant 14) → Briselames (D : rempart_vivant 20, peau_dure 22)
- **Arbalétrier** → Arbalétrier lourd (E1 : carreau_lourd 10, filet 14) → Arbalétrier de siège (M : rafale 20, estoc 24)
- **Chamane des crues** → Chamane des marées (E1 : javelot_glace 10, mains_lumiere 14) → Voix des eaux (S : onde_soin 20, armure_givre 22) | Chamane des glaces (A : blizzard 20, prison_glace 25)
- **Mineurs de fond** → Sapeurs (E1 : frappe_brutale 10, pietinement 14) → Brise-roches (M : enchainement 20, peau_dure 22)
- **Forgeron des runes** → Maître des runes (E1 : lame_ardente 10, aura_protection 14) → Prêtre de la forge (S : egide 20, lien_esprits 24) | Marteau runique (A : frappe_brutale 20, coup_assommant 22)
- **Éclaireuse des galeries** → Ombre des galeries (E1 : laceration 10, mirage 14) → Assassin des profondeurs (A : estoc 20, predateur 22)
- **Alchimiste** → Grenadier (E1 : jet_magma 10, putrefaction 14) → Maître alchimiste (M : meteore 20, peste 24)
- **Gardien de pierre** → Gardien de granit (E1 : cri_defi 10, peau_dure 14) → Montagne vivante (D : rempart_vivant 20, aura_protection 25)
- **Mage de cristal** → Cristallomancien (E1 : prison_glace 10, javelot_glace 14) → Mage du prisme (A : blizzard 20, maitrise_elem 24) | Gardien du cristal (S : armure_givre 20, egide 24)
- **Lanciers des cendres** → Lanciers de braise (E1 : lame_ardente 10, estoc 14) → Phalange de cendre (D : rempart_vivant 20, peau_dure 22) | Lanciers-dragons (A : bond 20, taillade 24)
- **Nomade des sables** → Cavalier des dunes (E1 : rafale 10, filet 14) → Archer du simoun (A : carreau_lourd 20, predateur 24)
- **Derviche** → Derviche tourneur (E1 : enchainement 10, mirage 14) → Derviche des tempêtes (M : taillade 20, lien_esprits 24)
- **Prêtresse du soleil** → Grande prêtresse (E1 : mains_lumiere 10, rayon_sacre 14) → Main du soleil (S : onde_soin 20, ferveur 22) | Flamme du soleil (A : jugement 20, consecration 24)
- **Scorpions dressés** → Scorpions de guerre (E1 : laceration 10, peau_dure 14) → Scorpions empereurs (M : pietinement 20, predateur 24)
- **Mage de cendre** → Mage de lave (E1 : jet_magma 10, lance_feu 14) → Seigneur des cendres (A : meteore 20, maitrise_elem 24) | Gardien des braises (S : bouclier_flammes 20, nova_flammes 22)
- **Garde de l'oasis** → Gardien de l'oasis (E1 : cri_defi 10, coup_assommant 14) → Rempart du désert (D : rempart_vivant 20, aura_protection 24)
- **Barde du désert** → Conteur (E1 : lien_esprits 10, vision_terreur 14) → Maître-chanteur (S : clarte 20, concentration 22) | Barde des cauchemars (A : hurlement_mental 20, domination 24)
- **Paladin de l'aube** → Paladin de lumière (E1 : chatiment 22, egide 24) → Champion de l'aube (D : rempart_vivant 25, aura_protection 27) | Croisé (A : jugement 25, consecration 27)
- **Archonte** → Archonte majeur (E1 : onde_soin 22, egide 24) → Séraphin (S : purification_masse 25, ferveur 27)
- **Lames jumelles** → Lames du crépuscule (E1 : enchainement 22, predateur 24) → Lames de l'éclipse (A : estoc 25, marque_mort 27)
- **Tireur astral** → Tireur céleste (E1 : rafale 22, carreau_lourd 24) → Œil des étoiles (A : estoc 25, predateur 27)
- **Oracle** → Haute oracle (E1 : vision_terreur 22, domination 24) → Voix du destin (M : sommeil 25, hurlement_mental 27)
- **Chevalier-griffon** → Chevalier du ciel (E1 : bond 22, pietinement 24) → Seigneur-griffon (M : taillade 25, cri_defi 27)
- **Invocatrice des tempêtes** → Tempétueuse (E1 : blizzard 22, lance_feu 24) → Maîtresse des tempêtes (A : meteore 25, maitrise_elem 27)
- **Gardiens célestes** → Gardiens séraphiques (E1 : rempart_vivant 22, peau_dure 24) → Légion céleste (D : aura_protection 25, egide 27)

---

## 5. Nouvelles troupes recrutables (90) et leurs évolutions

Chaque ville nouvelle recrute 6 types nouveaux + 2 types repris. Format : **Nom** (`id`) · unités/pop. · gabarit (retouches) · arme · rang · étiquettes · résistances · capacités (niveau) · emplacements · évolutions.

Emplacements : **A** = une main, armures légère/moyenne/lourde, bottes/anneau ; **L** = une main, armure légère, bottes/anneau ; **2M** = deux mains, armures moyenne/lourde, bottes/anneau/collier ; **T** = arc ou fronde, armure légère, bottes/anneau ; **M** = bâton ou orbe, robe, anneau/talisman ; **P** = une main ou bâton ou orbe, robe ou légère, anneau/talisman ; **B** = collier seulement ; **G** = gantelets, robe ou légère, bottes/anneau.

### 5.1 Val-Moussu (palier 1, niveau 1) · repris : Milicien, Frondeurs

- **Garde-champêtre** (`garde_champetre`) · 1/1 · REM · epee · 1 · humain · tranch. 10 · emploi 1, coup_bouclier 2, cri_defi 5, coup_assommant 9 · A · → Sergent du bourg (E1 : rempart_vivant 10, peau_dure 14) → Capitaine de milice (D : aura_protection 20, mur_boucliers 24) | Capitaine-bretteur (A : enchainement 20, estoc 24)
- **Faucheurs** (`faucheurs`) · 2/2 · BRE · lance · 1 · humain · — · emploi 1, repos 1, taillade 4, laceration 8 · 2M · → Moissonneurs (E1 : brise_genou 10, enchainement 14) → Faucheurs de guerre (A : estoc 20, predateur 24)
- **Bergère et ses chiens** (`bergere`) · 3/2 · BET (vit −1) · crocs · 1 · humain, bête · — · morsure 1, repos 1, hurlement 4, laceration 8 · B · → Meute du berger (E1 : bond 10, predateur 14) → Meute des collines (M : pietinement 20, instinct_meute 22)
- **Apicultrice** (`apicultrice`) · 1/1 · OCC (OMB→ maladie) · baton · 3 · humain · maladie 20 · emploi 1, putrefaction 1, meditation 1, fleau 5, nuage 9 · P · → Mère des ruches (E1 : peste 10, malefice 14) → Reine des essaims (A : nuee_ombres 20, peste 24)
- **Meunier costaud** (`meunier`) · 1/2 · BRU · masse_lourde · 1 · humain · contondant 15 · emploi 1, exploit 1, repos 1, frappe_brutale 4, pietinement 9 · 2M · → Meunier de fer (E1 : coup_assommant 10, peau_dure 14) → Colosse du moulin (D : rempart_vivant 20, riposte 22)
- **Guérisseuse du bourg** (`guerisseuse_bourg`) · 1/1 · PRE · masse · 3 · humain · sacré 20 · emploi 1, soin_mineur 1, meditation 1, bouclier_foi 4, mains_lumiere 9 · P · → Guérisseuse (E1 : onde_soin 10, purification 14) → Sainte du val (S : egide 20, ferveur 24) | Juge du val (A : rayon_sacre 20, jugement 25)

### 5.2 Saulnes (palier 1) · repris : Chasseur, Acolyte

- **Ondine apprivoisée** (`ondine_apprivoisee`) · 1/1 · MAG (glace) · baton · 3 · esprit · glace 30, feu −20 · emploi 1, eclat_glace 1, meditation 1, armure_givre 5, javelot_glace 9 · M · → Ondine des rapides (E1 : prison_glace 10, mains_lumiere 14) → Dame des eaux (S : onde_soin 20, armure_givre 22) | Ondine glaciale (A : blizzard 20, maitrise_elem 24)
- **Passeurs** (`passeurs`) · 2/2 · REM · lance · 1 · humain · glace 10 · emploi 1, repos 1, harpon_tir 3, coup_jarret 6 · A · → Gardes du gué (E1 : cri_defi 10, brise_genou 14) → Gardiens des ponts (D : rempart_vivant 20, peau_dure 22)
- **Pêcheuse à la nasse** (`pecheuse`) · 1/1 · TIR · fronde · 3 · humain · — · tir_fronde 1, repos 1, filet 3, marque 7 · T · → Pêcheuse des rapides (E1 : rafale 10, tir_recul 14) → Reine des filets (M : carreau_lourd 20, predateur 24)
- **Farfadet espiègle** (`farfadet`) · 1/1 · MYS (vit −3) · dague · 2 · fée · psychique 30 · emploi 1, confusion 1, mirage 3, vision_terreur 7 · L · → Farfadet malicieux (E1 : sommeil 10, domination 14) → Roi des tours (A : hurlement_mental 20, onde_mentale 24) | Farfadet gardien (S : clarte 20, lien_esprits 24)
- **Loutres de combat** (`loutres`) · 2/2 · BET (vit −2) · crocs · 1 · bête · glace 20 · morsure 1, repos 1, laceration 3, bond 8 · B · → Loutres géantes (E1 : enchainement 10, mirage 14) → Loutres des torrents (A : predateur 20, estoc 24)
- **Batelier colosse** (`batelier`) · 1/2 · BRU · masse_lourde · 1 · humain · — · emploi 1, repos 1, coup_massue 3, coup_assommant 8 · 2M · → Batelier de fer (E1 : frappe_brutale 10, cri_defi 14) → Colosse des quais (D : rempart_vivant 20, peau_dure 22)

### 5.3 Fort-Bruyère (palier 1) · repris : Écuyer, Braconniers

- **Brigands repentis** (`brigands`) · 2/2 · BRE · dague · 1 · humain · — · emploi 1, repos 1, laceration 3, enchainement 8 · L · → Coupe-jarrets (E1 : brise_genou 10, mirage 14) → Maîtres-voleurs (A : estoc 20, predateur 22)
- **Arbalétriers du fort** (`arbaletriers_fort`) · 2/2 · TIR · arbalete · 3 · humain · — · tir_arc 1, repos 1, carreau_lourd 5, rafale 9 · T · → Arbalétriers vétérans (E1 : estoc 10, filet 14) → Garde du rempart nord (M : tir_precis 20, predateur 24)
- **Druide des menhirs** (`druide_menhirs`) · 1/2 · PRE (FOI→ soins, ESP +2) · baton · 3 · humain · psychique 20 · emploi 1, seve 1, meditation 1, peau_ecorce 4, clarte 8, cercle_soins 14 · P · → Druide des pierres levées (E1 : onde_soin 10, aura_protection 14) → Archidruide (S : purification_masse 20, ferveur 24) | Druide du cercle noir (A : silence_tombe 20, malefice 22)
- **Chevaucheur de lande** (`chevaucheur`) · 1/2 · BRE (PV +20 %) · lance · 1 · humain · — · emploi 1, repos 1, charge 1, bond 6, pietinement 10 · 2M · → Cavalier de lande (E1 : taillade 10, cri_defi 14) → Chevalier de bruyère (M : enchainement 20, estoc 24)
- **Pleureuse** (`pleureuse`) · 1/1 · OCC · baton · 3 · humain · ténèbres 20, sacré −20 · emploi 1, trait_ombre 1, meditation 1, toucher_tombe 4, malediction 8 · M · → Pleureuse des tombes (E1 : drain_ame 10, marque_mort 14) → Voix des morts (A : nuee_ombres 20, silence_tombe 24)
- **Molosses de bruyère** (`molosses`) · 2/2 · BET · crocs · 1 · bête · — · morsure 1, repos 1, hurlement 4, laceration 8 · B · → Molosses de guerre (E1 : bond 10, peau_dure 14) → Molosses du fort (D : riposte 20, cri_defi 22) | Molosses sanguinaires (A : predateur 20, enchainement 24)

### 5.4 Brumefosse (palier 2, niveau 6) · repris : Loups jumeaux, Harponneur

- **Chasseurs de loups-garous** (`chasseurs_garous`) · 1/1 · TIR (FOI +2) · arbalete · 3 · humain · ténèbres 15 · tir_arc 1, repos 1, marque 3, carreau_lourd 6, chatiment 10 · T · → Traqueur d'argent (E1 : estoc 10, filet 14) → Inquisiteur des brumes (A : rayon_sacre 20, predateur 24)
- **Sorcière des brumes** (`sorciere_brumes`) · 1/2 · MYS · baton · 3 · humain · psychique 30 · emploi 1, murmure 1, meditation 1, mirage 4, domination 8, sommeil 14 · M · → Mère des brumes (E1 : onde_mentale 10, vision_terreur 14) → Sorcière des cauchemars (A : hurlement_mental 20, terreur_masse 24) | Tisseuse de brume (S : lien_esprits 20, clarte 22)
- **Garou repenti** (`garou`) · 1/2 · BRE (PV +15 %) · griffes · 1 · humain, bête · tranchant 15, sacré −20 · emploi 1, laceration 1, rage 1, bond 5, enchainement 9 · B · → Garou sauvage (E1 : predateur 10, hurlement 14) → Seigneur garou (A : taillade 20, estoc 24) | Garou ancien (D : peau_dure 20, riposte 22)
- **Bûcherons des pins** (`bucherons`) · 2/2 · BRU · hache2m · 1 · humain · — · emploi 1, repos 1, frappe_brutale 4, taillade 8 · 2M · → Abatteurs (E1 : enchainement 10, peau_dure 14) → Fendeurs de chênes (M : pietinement 20, coup_assommant 24)
- **Moine de la brume** (`moine_brume`) · 1/1 · MYS (FOR +2) · gantelets · 1 · humain · psychique 30 · emploi 1, meditation 1, repos 1, coup_assommant 4, mirage 8 · G · → Moine du voile (E1 : lame_psychique 10, clarte 14) → Poing de brume (A : enchainement 20, domination 24)
- **Corbeautière** (`corbeautiere`) · 1/1 · OCC · baton · 3 · humain · ténèbres 20 · emploi 1, trait_ombre 1, meditation 1, marque_mort 4, malefice 9 · M · → Dame des corbeaux (E1 : toucher_tombe 10, nuee_ombres 14) → Augure noire (M : silence_tombe 20, drain_ame 22)

### 5.5 Corbeval (palier 2) · repris : Adepte des ombres, Gardes de la marée

- **Fossoyeurs armés** (`fossoyeurs`) · 2/2 · BRE (FOI +1) · pioche · 1 · humain · ténèbres 15 · emploi 1, repos 1, coup_massue 3, chatiment 8 · A · → Gardiens des tombes (E1 : coup_assommant 10, cri_defi 14) → Veilleurs des cryptes (D : rempart_vivant 20, aura_protection 24)
- **Exorciste** (`exorciste`) · 1/1 · PRE · sceptre · 3 · humain · sacré 30, ténèbres 15 · emploi 1, trait_sacre 1, meditation 1, rayon_sacre 4, purification 8, consecration 14 · P · → Exorciste confirmé (E1 : mains_lumiere 10, jugement 14) → Grand exorciste (A : jugement 20, purification_masse 24) | Gardien des âmes (S : egide 20, onde_soin 22)
- **Squelettes liés** (`squelettes_lies`) · 3/2 · BRE (PV −10 %) · lame_rouillee · 1 · mort-vivant · maladie 50, sacré −40, contondant −20 · emploi 1, repos 1, lame_saignante 4 · B · non_mort 1 · → Squelettes guerriers (E1 : enchainement 10, peau_dure 14) → Légion d'os (M : taillade 20, cri_defi 22)
- **Nécrophage** (`necrophage`) · 1/2 · OCC (PV +10 %) · baton_os · 3 · humain · maladie 30 · emploi 1, putrefaction 1, meditation 1, peste 6, drain_ame 10 · M · → Maître des charniers (E1 : toucher_tombe 10, contagion 14) → Seigneur de la peste (A : nuee_ombres 20, peste 22) | Sculpteur d'os (S : silence_tombe 20, malefice 22)
- **Pénitent** (`penitent`) · 1/1 · BRE (VOL +20) · masse · 1 · humain · psychique 20 · emploi 1, pacte_sang 1, rage 1, frappe_brutale 4, enchainement 9 · A · → Flagellant (E1 : cri_defi 10, sang_froid 14) → Martyr (D : rempart_vivant 20, riposte 22) | Furieux sacré (A : chatiment 20, predateur 24)
- **Chien de cimetière** (`chien_cimetiere`) · 1/1 · BET · crocs · 1 · bête · ténèbres 20 · morsure 1, repos 1, hurlement 3, laceration 7 · B · → Chien des âmes (E1 : bond 10, predateur 14) → Molosse funèbre (M : peau_dure 20, enchainement 22)

### 5.6 Ambrerive (palier 2) · repris : Herboriste, Berserker

- **Gardes-forestiers** (`gardes_forestiers`) · 2/2 · TIR · arc · 3 · humain · — · tir_arc 1, repos 1, tir_empoisonne 3, rafale 8 · T · → Gardes de l'ambre (E1 : estoc 10, filet 14) → Archers sylvestres (A : carreau_lourd 20, predateur 24)
- **Dryade alliée** (`dryade`) · 1/2 · PRE (vit +1) · baton · 3 · plante · maladie 30, feu −30 · emploi 1, seve 1, meditation 1, peau_ecorce 4, mains_lumiere 8, cercle_soins 14 · M · → Dryade d'automne (E1 : onde_soin 10, purification 14) → Mère-Dryade (S : purification_masse 20, ferveur 22) | Dryade des ronces (M : carapace_epines 20, peste 24)
- **Ours d'ambre** (`ours_ambre`) · 1/2 · BRU · griffes · 1 · bête · glace 20, feu −10 · emploi 1, repos 1, frappe_brutale 3, pietinement 8 · B · → Ours roux (E1 : laceration 10, peau_dure 14) → Ours-roi (D : rempart_vivant 20, riposte 22) | Ours enragé (A : rage 20, enchainement 22)
- **Cueilleuse de champignons** (`cueilleuse`) · 1/1 · OCC (OMB → maladie) · masse · 3 · humain · maladie 30 · emploi 1, putrefaction 1, meditation 1, fleau 5, affaiblissement 9 · P · → Mycologue (E1 : peste 10, malefice 14) → Reine des spores (A : nuee_ombres 20, peste 22)
- **Cerfs de guerre** (`cerfs`) · 2/2 · BET (PV +10 %) · crocs · 1 · bête · — · morsure 1, repos 1, charge 3, pietinement 9 · B · → Cerfs d'ambre (E1 : bond 10, cri_defi 14) → Grands cerfs (M : peau_dure 20, taillade 24)
- **Archère sylvaine** (`archere_sylvaine`) · 1/1 · TIR (ÉLÉ +2) · arc · 3 · plante · glace 15 · tir_arc 1, repos 1, fleche_givre 4, fleche_feu 8 · T · → Archère d'automne (E1 : rafale 10, lame_ardente 14) → Archère des saisons (A : estoc 20, javelot_glace 24)

### 5.7 Givrecime (palier 3, niveau 11) · repris : Mage de cristal, Mineurs de fond

- **Nains du givre** (`nains_givre`) · 2/2 · REM (PV +10 %) · hache2m · 1 · nain · glace 30, contondant 10 · emploi 1, repos 1, cri_defi 3, frappe_brutale 7 · 2M · → Gardes de la crête (E1 : rempart_vivant 10, peau_dure 14) → Briseurs de glace (A : taillade 20, enchainement 24) | Mur de givre (D : aura_protection 20, riposte 22)
- **Chamane du blizzard** (`chamane_blizzard`) · 1/2 · MAG · baton · 3 · humain · glace 40, feu −20 · emploi 1, eclat_glace 1, meditation 1, javelot_glace 4, tempete_givre 8, prison_glace 14 · M · → Voix de l'hiver (E1 : blizzard 10, armure_givre 14) → Reine du blizzard (A : maitrise_elem 20, meteore 25) | Gardienne des glaces (S : egide 20, mains_lumiere 22)
- **Yéti apprivoisé** (`yeti`) · 1/3 · BRU (PV +10 %) · griffes · 1 · bête · glace 60, feu −30 · emploi 1, repos 1, frappe_brutale 3, pietinement 7, coup_assommant 12 · B · → Yéti des cimes (E1 : peau_dure 10, rage 14) → Yéti ancien (D : rempart_vivant 20, riposte 22)
- **Skieurs-éclaireurs** (`skieurs`) · 2/2 · TIR (vit −2) · arc · 3 · humain · glace 20 · tir_arc 1, repos 1, fleche_givre 3, rafale 8 · T · → Patrouilleurs des neiges (E1 : estoc 10, filet 14) → Fantômes blancs (A : predateur 20, carreau_lourd 24)
- **Ermite des glaciers** (`ermite`) · 1/1 · MYS · gantelets · 2 · humain · psychique 30, glace 20 · emploi 1, meditation 1, clarte 3, sommeil 8, lien_esprits 13 · G · → Sage des glaciers (E1 : concentration 10, domination 14) → Œil de l'hiver (S : sang_froid 20, lien_esprits 22) | Esprit des cimes (A : hurlement_mental 20, lame_psychique 22)
- **Ours polaires** (`ours_polaires`) · 2/3 · BET (PV +25 %) · griffes · 1 · bête · glace 40 · morsure 1, repos 1, laceration 3, pietinement 9 · B · → Ours de banquise (E1 : bond 10, peau_dure 14) → Ours des tempêtes (M : enchainement 20, predateur 24)

### 5.8 Lanterne-Noire (palier 3) · repris : Éclaireuse des galeries, Sorcière des marais

- **Lame elfe noire** (`lame_elfe_noire`) · 1/1 · BRE (vit −2) · dague · 1 · elfe · ténèbres 30, sacré −20 · emploi 1, repos 1, laceration 3, lame_ombre 6, estoc 11 · L · → Lame de la nuit (E1 : mirage 10, predateur 14) → Danseuse d'ombre (A : enchainement 20, marque_mort 24)
- **Tisseuse de soie noire** (`tisseuse`) · 1/2 · OCC · baton · 3 · elfe · ténèbres 30, maladie 20 · emploi 1, trait_ombre 1, meditation 1, jet_toile 4, malefice 8, silence_tombe 14 · M · → Matriarche (E1 : drain_ame 10, peste 14) → Grande matriarche (A : nuee_ombres 20, marque_mort 24) | Fileuse de destins (S : malediction 20, sommeil 22)
- **Araignées dressées** (`araignees_dressees`) · 2/2 · BET · chelicères · 1 · bête · maladie 40, feu −25 · morsure_venin 1, repos 1, jet_toile 4, laceration 9 · B · → Araignées-loups (E1 : bond 10, peste 14) → Araignées géantes (M : predateur 20, peau_dure 22)
- **Porte-lanterne** (`porte_lanterne`) · 1/1 · PRE · masse · 3 · humain · ténèbres 30, sacré 20 · emploi 1, soin_mineur 1, meditation 1, rayon_sacre 4, egide 9 · P · → Gardien de la flamme (E1 : mains_lumiere 10, consecration 14) → Phare vivant (S : onde_soin 20, aura_protection 24) | Porteur d'aube (A : jugement 20, rayon_sacre 22)
- **Arbalétrières drows** (`arbaletrieres_drows`) · 2/2 · TIR · arbalete · 3 · elfe · ténèbres 20 · tir_arc 1, repos 1, tir_empoisonne 3, carreau_lourd 8 · T · → Arbalétrières de la nuit (E1 : rafale 10, marque_mort 14) → Veuves noires (A : predateur 20, estoc 24)
- **Champignon errant** (`champignon_errant`) · 1/2 · REM (PV +20 %, vit +2) · branches · 1 · plante · maladie 60, feu −30 · emploi 1, repos 1, nuage 3, carapace_epines 7 · B · → Champignon colossal (E1 : peste 10, peau_dure 14) → Seigneur des spores (D : rempart_vivant 20, aura_protection 24)

### 5.9 Braise-Haute (palier 3) · repris : Gardien de pierre, Alchimiste

- **Forgeronne de lave** (`forgeronne_lave`) · 1/2 · REM (ÉLÉ +3) · masse · 1 · nain · feu 40, glace −20 · emploi 1, repos 1, lame_ardente 3, cri_defi 7, bouclier_flammes 12 · A · → Maîtresse de la forge (E1 : frappe_brutale 10, aura_protection 14) → Enclume vivante (D : rempart_vivant 20, peau_dure 22) | Marteau de braise (A : jet_magma 20, enchainement 22)
- **Pyromancien de caldeira** (`pyro_caldeira`) · 1/2 · MAG · baton · 3 · humain · feu 50, glace −25 · emploi 1, trait_flammes 1, meditation 1, lance_feu 4, nova_flammes 9, meteore 15 · M · → Mage du cratère (E1 : jet_magma 10, bouclier_flammes 14) → Cœur de volcan (A : maitrise_elem 20, pluie_feu 22)
- **Salamandres domptées** (`salamandres`) · 2/2 · BET · crocs · 1 · bête, reptile · feu 60, glace −30 · morsure 1, repos 1, lame_ardente 3, souffle_feu 8 · B · → Salamandres de lave (E1 : bond 10, peau_dure 14) → Salamandres ancestrales (M : predateur 20, nova_flammes 24)
- **Gardiens de basalte** (`gardiens_basalte`) · 1/3 · CON · masse_lourde · 1 · construct · feu 40, tranchant 20, contondant 20 · emploi 1, repos 1, provocation 3, pietinement 8, peau_dure 12 · 2M · → Basalte vivant (E1 : rempart_vivant 10, coup_assommant 14) → Colosse de lave (D : aura_protection 20, riposte 22)
- **Prêtresse des cendres** (`pretresse_cendres`) · 1/1 · PRE (ÉLÉ +2) · sceptre · 3 · humain · feu 30 · emploi 1, soin_mineur 1, meditation 1, bouclier_flammes 4, mains_lumiere 9 · P · → Voix de la flamme (E1 : onde_soin 10, egide 14) → Sainte des braises (S : ferveur 20, purification_masse 24)
- **Briseurs d'obsidienne** (`briseurs_obsidienne`) · 2/2 · BRE · hache2m · 1 · humain · feu 20 · emploi 1, repos 1, enchainement 4, taillade 8 · 2M · → Briseurs de verre (E1 : estoc 10, laceration 14) → Lames d'obsidienne (A : predateur 20, frappe_brutale 22)

### 5.10 Port-Corsaire (palier 4, niveau 16) · repris : Arbalétrier, Lanciers des cendres

- **Corsaires** (`corsaires`) · 2/2 · BRE · epee · 1 · humain · — · emploi 1, repos 1, enchainement 1, laceration 4, estoc 9 · L · → Flibustiers (E1 : mirage 10, brise_genou 14) → Écumeurs (A : taillade 20, predateur 22)
- **Canonnière** (`canonniere`) · 1/2 · TIR (FOR +3) · arbalete · 3 · humain · feu 20 · tir_arc 1, repos 1, carreau_lourd 1, jet_magma 5, rafale 10 · T · → Maîtresse canonnière (E1 : estoc 10, coup_assommant 14) → Bordée (M : meteore 20, carreau_lourd 22)
- **Naga des récifs** (`naga`) · 1/2 · MAG (glace) · lance · 2 · reptile · glace 40, feu −20 · emploi 1, javelot_glace 1, meditation 1, toucher_tombe 5, blizzard 11 · M · → Naga des marées (E1 : prison_glace 10, armure_givre 14) → Reine naga (A : maitrise_elem 20, souffle_glacial 22) | Naga oracle (S : clarte 20, onde_soin 22)
- **Sirène renégate** (`sirene`) · 1/1 · MYS · dague · 3 · humain, esprit · psychique 40 · emploi 1, murmure 1, meditation 1, sommeil 4, domination 9 · L · → Chanteuse des abysses (E1 : hurlement_mental 10, onde_mentale 14) → Sirène reine (A : terreur_masse 20, vision_terreur 22)
- **Crabes de guerre** (`crabes`) · 2/2 · REM (PV +15 %, vit +2) · griffes · 1 · bête · tranchant 30, contondant 20, feu −20 · morsure 1, repos 1, provocation 4, carapace_epines 8 · B · → Crabes cuirassés (E1 : peau_dure 10, coup_assommant 14) → Crabes titans (D : rempart_vivant 20, aura_protection 24)
- **Aumônier de bord** (`aumonier`) · 1/1 · PRE · masse · 3 · humain · sacré 20, glace 15 · emploi 1, soin_mineur 1, meditation 1, mains_lumiere 3, egide 8, onde_soin 14 · P · → Aumônier de la flotte (E1 : purification 10, rayon_sacre 14) → Bénédiction des mers (S : purification_masse 20, ferveur 22)

### 5.11 Verdeloin (palier 4) · repris : Scorpions dressés, Nomade des sables

- **Homme-fauve** (`homme_fauve`) · 1/2 · BRE (PV +15 %, vit −1) · griffes · 1 · humain, bête · — · emploi 1, laceration 1, bond 3, predateur 7, enchainement 12 · B · → Fauve alpha (E1 : rage 10, hurlement 14) → Roi-jaguar (A : estoc 20, taillade 24) | Fauve ancestral (D : peau_dure 20, riposte 22)
- **Sarbacanières** (`sarbacanieres`) · 2/2 · TIR · dard_s · 3 · humain · maladie 30 · tir_fronde 1, repos 1, tir_empoisonne 1, putrefaction 6, rafale 11 · T · → Sarbacanières de jade (E1 : peste 10, filet 14) → Ombres de la canopée (A : predateur 20, marque_mort 22)
- **Chamane-crapaud** (`chamane_crapaud`) · 1/2 · OCC (PV +10 %) · baton · 3 · reptile · maladie 50 · emploi 1, fleau 1, meditation 1, peste 5, malefice 10 · M · → Grand crapaud sacré (E1 : drain_ame 10, putrefaction 14) → Prophète des marais (A : nuee_ombres 20, silence_tombe 22)
- **Gorille de guerre** (`gorille`) · 1/3 · BRU (PV +10 %) · gantelets · 1 · bête · contondant 20 · emploi 1, repos 1, frappe_brutale 1, pietinement 5, coup_assommant 10 · B · → Gorille argenté (E1 : rage 10, cri_defi 14) → Roi des singes (M : enchainement 20, peau_dure 22)
- **Prêtresse de jade** (`pretresse_jade`) · 1/2 · PRE · sceptre · 3 · humain · psychique 20, maladie 20 · emploi 1, mains_lumiere 1, meditation 1, egide 4, onde_soin 9, purification_masse 15 · P · → Gardienne du temple (E1 : seve 10, aura_protection 14) → Voix de Quetzal (S : ferveur 20, cercle_soins 22)
- **Serpents de temple** (`serpents_temple`) · 2/2 · BET (vit −2) · dard_s · 1 · reptile · maladie 40, glace −20 · morsure_venin 1, repos 1, laceration 4, bond 9 · B · → Serpents royaux (E1 : peste 10, predateur 14) → Serpents à plumes (M : estoc 20, mirage 22)

### 5.12 Kharak (palier 4) · repris : Derviche, Garde de l'oasis

- **Centaure archer** (`centaure`) · 1/2 · TIR (PV +20 %) · arc · 3 · centaure · — · tir_arc 1, repos 1, rafale 3, estoc 8, carreau_lourd 13 · T · → Centaure des vents (E1 : bond 10, predateur 14) → Seigneur centaure (A : tir_precis 20, rafale 22)
- **Orcs mercenaires** (`orcs`) · 2/2 · BRU · hache2m · 1 · orc · — · emploi 1, repos 1, rage 1, frappe_brutale 4, taillade 9 · 2M · → Orcs berserkers (E1 : enchainement 10, cri_defi 14) → Horde (M : pietinement 20, predateur 22)
- **Chamane des tempêtes** (`chamane_tempetes`) · 1/2 · MAG (ESP +3) · baton · 3 · orc · glace 20, psychique 20 · emploi 1, eclat_glace 1, meditation 1, onde_mentale 4, blizzard 10 · M · → Appeleur de foudre (E1 : jet_magma 10, prison_glace 14) → Œil du cyclone (A : meteore 20, hurlement_mental 22) | Esprit des steppes (S : lien_esprits 20, armure_givre 22)
- **Hyènes dressées** (`hyenes`) · 3/2 · BET (PV −10 %, vit −2) · crocs · 1 · bête · maladie 20 · morsure 1, repos 1, laceration 3, predateur 9 · B · → Hyènes rieuses (E1 : hurlement 10, bond 14) → Meute des charognes (M : instinct_meute 20, peste 22)
- **Khan des steppes** (`khan`) · 1/2 · REM (ESP +3) · epee · 1 · orc · tranchant 15 · emploi 1, cri_defi 1, cri_guerre 4, chant_guerre 8, rempart_vivant 13 · A · → Khan des clans (E1 : lien_esprits 10, aura_protection 14) → Grand Khan (S : clarte 20, mur_boucliers 22) | Khan de guerre (A : enchainement 20, cri_guerre 22)
- **Harpies dressées** (`harpies_dressees`) · 3/2 · BET (vit −3) · griffes · 1 · bête · glace 20 · morsure 1, repos 1, cri_effroi 4, laceration 9 · B · → Harpies d'orage (E1 : bond 10, hurlement_mental 14) → Harpies reines (M : predateur 20, mirage 22)

### 5.13 Ys-la-Profonde (palier 5, niveau 21) · repris : Tireur astral, Oracle

- **Hommes-poissons guerriers** (`hommes_poissons`) · 2/2 · BRE · lance · 1 · poisson · glace 30, feu −20 · emploi 1, repos 1, harpon_tir 1, estoc 3, enchainement 8 · A · → Gardes des profondeurs (E1 : peau_dure 22, brise_genou 24) → Légion abyssale (M : taillade 25, predateur 27)
- **Oracle noyée** (`oracle_noyee`) · 1/2 · MYS (OMB +3) · baton · 3 · mort-vivant · psychique 40, glace 30 · emploi 1, murmure 1, meditation 1, domination 3, onde_mentale 8, sommeil 13 · M · → Voix d'Ys (E1 : hurlement_mental 22, drain_ame 24) → Prophétesse engloutie (A : terreur_masse 25, vision_terreur 27)
- **Méduses porteuses** (`meduses`) · 3/2 · OCC (PV −10 %) · dard · 2 · bête · glace 30, psychique 20 · emploi 1, putrefaction 1, toucher_tombe 5, peste 10 · B · → Méduses lumineuses (E1 : sommeil 22, silence_tombe 24) → Couronnes des abysses (M : nuee_ombres 25, peste 27)
- **Prêtre des marées** (`pretre_marees`) · 1/2 · PRE (ÉLÉ +3) · sceptre · 3 · humain · glace 30, sacré 20 · emploi 1, mains_lumiere 1, meditation 1, armure_givre 3, onde_soin 8, egide 13 · P · → Grand prêtre d'Ys (E1 : purification_masse 22, cercle_soins 24) → Cœur des marées (S : ferveur 25, aura_protection 27)
- **Requin-garou** (`requin_garou`) · 1/3 · BRU (vit −2) · machoires · 1 · bête, poisson · glace 30 · emploi 1, laceration 1, bond 3, predateur 6, frappe_brutale 11 · B · → Requin-garou alpha (E1 : rage 22, enchainement 24) → Mangeur d'hommes (A : estoc 25, taillade 27)
- **Scaphandrier** (`scaphandrier`) · 1/2 · REM (PV +25 %, vit +3) · masse_lourde · 1 · humain, construct · glace 40, tranchant 25, contondant 25, feu −20 · emploi 1, provocation 1, cri_defi 3, rempart_vivant 8, coup_assommant 13 · 2M · → Scaphandrier de fer (E1 : peau_dure 22, aura_protection 24) → Cloche des abysses (D : riposte 25, egide 27)

### 5.14 Citadelle d'Obsidienne (palier 5) · repris : Paladin de l'aube, Lames jumelles

- **Démoniste** (`demoniste`) · 1/2 · OCC (ÉLÉ +3) · baton · 3 · humain · feu 30, ténèbres 30, sacré −30 · emploi 1, trait_ombre 1, meditation 1, pacte_sang 3, drain_ame 8, nuee_ombres 13 · M · → Maître des pactes (E1 : malefice 22, lance_feu 24) → Seigneur démoniste (A : meteore 25, silence_tombe 27) | Lieur d'âmes (S : marque_mort 25, lien_vital 27)
- **Chevalier d'obsidienne** (`chevalier_obsidienne`) · 1/3 · REM (FOR +3) · epee · 1 · humain · feu 30, tranchant 20, contondant 20 · emploi 1, provocation 1, cri_defi 3, frappe_brutale 8, rempart_vivant 13 · A · → Chevalier noir (E1 : peau_dure 22, chatiment 24) → Rempart de verre (D : aura_protection 25, riposte 27) | Champion d'obsidienne (A : enchainement 25, estoc 27)
- **Succube repentie** (`succube`) · 1/2 · MYS (OMB +3) · dague · 2 · démon · feu 40, sacré −30 · emploi 1, domination 1, meditation 1, drain_ame 4, vision_terreur 9 · L · → Tentatrice (E1 : sommeil 22, mirage 24) → Reine des désirs (A : hurlement_mental 25, terreur_masse 27)
- **Molosses de verre** (`molosses_verre`) · 2/2 · BET · crocs · 1 · bête, démon · feu 50, sacré −30 · morsure 1, repos 1, lame_ardente 1, bond 5, predateur 10 · B · → Molosses ardents (E1 : souffle_feu 22, peau_dure 24) → Chiens de l'abîme (M : enchainement 25, nova_flammes 27)
- **Inquisitrice de l'aube** (`inquisitrice`) · 1/2 · PRE (FOR +2) · sceptre · 2 · humain · sacré 40, ténèbres 30, feu 20 · emploi 1, rayon_sacre 1, meditation 1, jugement 4, consecration 9, egide 14 · P · → Main de l'aube (E1 : chatiment 22, purification_masse 24) → Lumière vengeresse (A : jugement 25, maitrise_elem 27) | Bouclier de l'aube (S : onde_soin 25, ferveur 27)
- **Arbalétriers de verre** (`arbaletriers_verre`) · 2/2 · TIR · arbalete · 3 · humain · feu 30 · tir_arc 1, repos 1, carreau_lourd 1, rafale 5, estoc 10 · T · → Tireurs d'obsidienne (E1 : marque_mort 22, predateur 24) → Œil de verre (A : tir_precis 25, carreau_lourd 27)

### 5.15 Lune-Dormante (palier 5) · repris : Archonte, Invocatrice des tempêtes

- **Chevaliers de lune** (`chevaliers_lune`) · 2/3 · REM (FOI +2) · epee · 1 · fée · psychique 30, ténèbres 20 · emploi 1, provocation 1, cri_defi 3, chatiment 7, rempart_vivant 12 · A · → Gardiens du rêve (E1 : aura_protection 22, peau_dure 24) → Ordre de la lune (D : egide 25, riposte 27)
- **Fée des songes** (`fee_songes`) · 1/1 · MYS (vit −3) · baton · 3 · fée · psychique 50 · emploi 1, sommeil 1, meditation 1, clarte 3, domination 8, lien_esprits 13 · M · → Fée du crépuscule (E1 : onde_mentale 22, mirage 24) → Reine des songes (S : sang_froid 25, hurlement_mental 27) | Fée cauchemar (A : vision_terreur 25, terreur_masse 27)
- **Licorne d'argent** (`licorne`) · 1/3 · PRE (PV +40 %, FOR +4, vit −4) · crocs · 1 · bête, fée · sacré 40, ténèbres 30 · morsure 1, mains_lumiere 1, charge 3, purification 8, onde_soin 13 · B · → Licorne de lune (E1 : egide 22, bond 24) → Licorne d'aube (S : purification_masse 25, ferveur 27)
- **Archères de rosée** (`archeres_rosee`) · 2/2 · TIR · arc · 3 · fée · psychique 20 · tir_arc 1, repos 1, rafale 1, fleche_givre 5, estoc 10 · T · → Archères d'argent (E1 : predateur 22, marque 24) → Chasseresses de lune (A : carreau_lourd 25, tir_precis 27)
- **Dormeur éveillé** (`dormeur`) · 1/3 · CON (ESP +4) · masse_lourde · 1 · géant, fée · psychique 40, contondant 20 · emploi 1, repos 1, pietinement 3, sommeil 8, frappe_brutale 13 · 2M · → Géant du rêve (E1 : peau_dure 22, hurlement_mental 24) → Titan endormi (D : rempart_vivant 25, aura_protection 27)
- **Tisseur de rêves** (`tisseur_reves`) · 1/2 · MYS (FOI +3) · orbe · 3 · fée · psychique 40 · emploi 1, lame_psychique 1, meditation 1, mirage 3, onde_mentale 8, domination 13 · M · → Maître des songes (E1 : sommeil 22, clarte 24) → Architecte du rêve (A : hurlement_mental 25, vision_terreur 27)

---

## 6. Les 24 gardiens des routes nouvelles

Gabarit GAR (ou CON/BRU pour certains, PV ×1 de la valeur GAR), population pour le budget de la rencontre, immunités, capacités (toutes connues). Ils laissent le composant de gardien de leur route (contenu-cible-monde.md, section 4).

| Route | Gardien | Pop. | Étiquettes | Résistances | Immunités | Capacités |
|---|---|---|---|---|---|---|
| R06 | Taureau de Brande | 4 | bête | contondant 20 | — | morsure, charge, pietinement, frappe_brutale, cri_defi, repos |
| R07 | Dame du Gué | 4 | esprit | glace 40, feu −30 | glace | emploi, javelot_glace, prison_glace, mains_lumiere, armure_givre, meditation |
| R08 | Menhir éveillé | 4 | construct | tranchant 30, contondant 20, psychique 50 | psychique | emploi, pietinement, coup_assommant, peau_dure, provocation |
| R09 | Roi des Farfadets | 4 | fée | psychique 40 | psychique | emploi, domination, sommeil, mirage, vision_terreur, onde_mentale |
| R10 | Bourreau sans tête | 4 | mort-vivant | maladie 50, sacré −40 | maladie | emploi, frappe_brutale, enchainement, cri_defi, non_mort, rage |
| R11 | Grande Ondine | 4 | esprit | glace 50, feu −30 | glace | emploi, blizzard, javelot_glace, onde_soin, armure_givre, meditation |
| R12 | Gardien-Chêne | 4 | plante | tranchant 25, maladie 40, feu −40 | maladie | emploi, pietinement, seve, carapace_epines, peste, riposte |
| R13 | Héron colossal | 6 | bête | glace 30 | — | morsure, bond, estoc, laceration, cri_effroi, repos |
| R14 | Loup-garou alpha | 6 | bête, humain | tranchant 30, sacré −30 | — | morsure, bond, enchainement, rage, hurlement, predateur |
| R15 | Seigneur Liche des Lanternes | 6 | mort-vivant | ténèbres 60, maladie 50, sacré −40 | maladie | emploi, nuee_ombres, drain_ame, silence_tombe, malefice, non_mort |
| R16 | Druide-Liche | 6 | mort-vivant, plante | maladie 50, ténèbres 40, feu −30 | maladie | emploi, peste, drain_ame, seve, carapace_epines, non_mort |
| R17 | Ours de magma | 6 | bête, élémentaire | feu 60, glace −30 | feu | morsure, frappe_brutale, nova_flammes, pietinement, rage, repos |
| R18 | Wyrm des neiges | 8 | dragon | glace 60, feu −20 | glace | morsure, souffle_glacial, prison_glace, bond, peau_dure, repos |
| R19 | Mammouth de guerre | 8 | bête | glace 50, contondant 20 | — | morsure, pietinement, frappe_brutale, cri_defi, peau_dure, repos |
| R20 | Reine des Spores | 8 | plante | maladie 70, feu −40 | maladie | emploi, peste, nuee_ombres, putrefaction, sommeil, carapace_epines |
| R21 | Ver-Racine | 8 | bête, plante | tranchant 30, maladie 40 | — | morsure, pietinement, jet_toile, peste, peau_dure, riposte |
| R22 | Seigneur des Braises | 8 | élémentaire, démon | feu 70, sacré −30 | feu | emploi, meteore, nova_flammes, bouclier_flammes, lame_ardente, jet_magma |
| R23 | Amiral noyé | 10 | mort-vivant | maladie 50, glace 30, sacré −40 | maladie | emploi, enchainement, cri_defi, drain_ame, carreau_lourd, non_mort |
| R24 | Kraken ancien | 10 | bête | glace 50, psychique 30 | glace | morsure, pietinement, harpon_tir, filet, hurlement_mental, peau_dure |
| R25 | Lion-Roi de Khar | 10 | bête | tranchant 20 | — | morsure, bond, predateur, hurlement, enchainement, rage |
| R26 | Quetzal-Serpent | 10 | dragon | maladie 50, psychique 30 | maladie | morsure, peste, domination, souffle_feu, mirage, egide |
| R27 | Esprit-Tempête | 10 | élémentaire | glace 50, psychique 40 | psychique | emploi, blizzard, hurlement_mental, onde_mentale, mirage, prison_glace |
| R28 | Léviathan d'obsidienne | 8 | dragon, démon | feu 50, glace 50, sacré −20 | feu | morsure, souffle_glacial, meteore, pietinement, peau_dure, rage |
| R29 | Gardien du Pont | 8 | démon, construct | ténèbres 50, feu 40, sacré −30 | ténèbres | emploi, nuee_ombres, silence_tombe, rempart_vivant, frappe_brutale, aura_protection |

Population des gardiens = valeur de la colonne × 2 pour le budget de l'étape avec escorte (README 20) ; le gardien seul compte pour la valeur indiquée.

---

## 7. Bestiaires des 15 régions nouvelles

8 monstres par région, 4 **légers** (étapes 1-2) puis 4 **lourds** (étapes 3-4 et escorte du gardien). Format : Nom (`id`) · unités/pop. · gabarit (retouches) · arme · rang · étiquettes · résistances · **immunité** · capacités · butin (matériaux de la région sauf mention).

### 7.1 Val-Moussu (6)
Légers : **Sanglier des prés** (`sanglier`) 1/1 BET (PV +15 %) crocs 1 · bête · — · morsure, charge, repos · Défense de sanglier, Laine grasse — **Lièvres cornus** (`lievres`) 3/2 BET (PV −20 %) crocs 1 · bête · — · morsure, repos · Laine grasse, Blé noir — **Bourdons géants** (`bourdons`) 3/2 BET (vit −3) dard 1 · bête · maladie 20 · morsure_venin, repos · Soie de bourdon — **Kobolds des prés** (`kobolds_pres`) 2/2 BRE crocs 1 · kobold · — · emploi, laceration, repos · Blé noir, Défense de sanglier.
Lourds : **Épouvantail animé** (`epouvantail`) 1/2 CON branches 1 · construct · feu −40 · **psychique** · emploi, cri_effroi, repos · Blé noir, Laine grasse — **Ours brun** (`ours_brun`) 1/3 BRU griffes 1 · bête · glace 20 · morsure, frappe_brutale, repos · Défense de sanglier, Miel royal — **Brigands des haies** (`brigands_haies`) 2/2 BRE dague 1 · humain · — · emploi, enchainement, laceration, repos · Cuir de bandit, Soie de bourdon — **Sorcière des haies** (`sorciere_haies`) 1/2 OCC baton 3 · humain · maladie 20 · emploi, putrefaction, malediction, meditation · Miel royal, Blé noir.

### 7.2 Rives du Saule (7)
Légers : **Grenouilles-taureaux** (`grenouilles`) 2/2 BET crocs 1 · bête · maladie 20 · morsure, jet_toile, repos · Écaille de brochet — **Rats d'eau** (`rats_eau`) 3/2 BET (PV −20 %) crocs 1 · bête · maladie 30 · morsure, repos · Roseau tressé — **Farfadets** (`farfadets`) 2/2 MYS dague 2 · fée · psychique 30 · emploi, confusion, mirage · Galet chantant — **Lavandière de nuit** (`lavandiere`) 1/2 MYS mains_spectrales 3 · esprit · tranchant 30, sacré −30 · — · emploi, murmure, vision_terreur · Roseau tressé, Galet chantant.
Lourds : **Ondine** (`ondine`) 1/2 ELM (glace) baton_m 3 · esprit · glace 50, feu −30 · **glace** · emploi, javelot_glace, armure_givre, meditation · Perle d'ondine, Galet chantant — **Brochet géant** (`brochet`) 1/2 BET (PV +20 %) machoires 1 · bête · glace 20 · morsure, bond, laceration · Écaille de brochet — **Nymphe des saules** (`nymphe`) 1/2 PRE baton 3 · fée · maladie 30, feu −30 · emploi, soin_mineur, seve, meditation · Écorce de saule — **Troll garde-pont** (`troll_pont`) 1/3 BRU gourdin 1 · géant · contondant 20, feu −20 · emploi, frappe_brutale, riposte, repos · Écorce de saule, Écaille de brochet.

### 7.3 Landes de Bruyère (8)
Légers : **Bandits des landes** (`bandits`) 2/2 BRE coutelas 1 · humain · — · emploi, laceration, repos · Cuir de bandit — **Arbalétriers déserteurs** (`deserteurs`) 2/2 TIR arbalete 3 · humain · — · tir_arc, carreau_lourd, repos · Cuir de bandit, Plume de corneille — **Chiens de bruyère** (`chiens_bruyere`) 2/2 BET crocs 1 · bête · — · morsure, hurlement, repos · Bruyère sèche — **Corneilles noires** (`corneilles`) 3/2 BET (PV −25 %, vit −2) bec 1 · bête · contondant −20 · morsure, cri_effroi · Plume de corneille.
Lourds : **Esprit de menhir** (`esprit_menhir`) 1/2 CON poing_pierre 1 · construct, esprit · tranchant 30, contondant 20 · **psychique** · emploi, coup_assommant, peau_dure · Éclat de menhir, Rune de menhir — **Chef de bande** (`chef_bande`) 1/2 REM epee 1 · humain · tranchant 15 · emploi, cri_defi, enchainement, repos · Cuir de bandit, Rune de menhir — **Rebouteuse maudite** (`rebouteuse`) 1/2 OCC baton_os 3 · humain · ténèbres 30 · emploi, toucher_tombe, malefice, soin_mineur · Bruyère sèche, Éclat de menhir — **Bélier des landes** (`belier`) 1/2 BET (PV +20 %) branches 1 · bête · contondant 20 · morsure, charge, pietinement · Bruyère sèche.

### 7.4 Collines Brumeuses (9)
Légers : **Chauves-souris géantes** (`chauves_souris_g`) 3/2 BET (PV −20 %) bec 1 · bête · — · morsure, toucher_tombe · Brume condensée — **Chasseurs de primes** (`chasseurs_primes`) 2/2 TIR arbalete 3 · humain · — · tir_arc, filet, repos · Bois de pin noir — **Pendus** (`pendus`) 2/2 BRE lame_rouillee 1 · mort-vivant · maladie 40, sacré −40 · **maladie** · emploi, lame_saignante, non_mort · Brume condensée — **Corbeau de mauvais augure** (`corbeau_augure`) 1/1 MYS bec 2 · bête · psychique 30 · morsure, vision_terreur, marque_mort · Brume condensée, Croc lunaire.
Lourds : **Loup-garou** (`loup_garou`) 1/2 BRE (PV +20 %) griffes_m 1 · bête, humain · tranchant 30, sacré −30 · morsure, bond, rage, laceration · Fourrure de loup-garou, Croc lunaire — **Sorcière des brumes** (`sorciere_brumes_m`) 1/2 MYS baton_m 3 · humain · psychique 30 · emploi, domination, sommeil, meditation · Œil de sorcière, Brume condensée — **Ours des brumes** (`ours_brumes`) 1/3 BRU griffes_m 1 · bête · glace 20 · morsure, frappe_brutale, pietinement · Fourrure de loup-garou — **Brumeux** (`brumeux`) 1/2 ELM mains_spectrales 2 · esprit · psychique 30, sacré −30 · **tranchant** · emploi, onde_mentale, mirage · Brume condensée, Œil de sorcière.

### 7.5 Val des Tombes (10)
Légers : **Squelettes** (`squelettes`) 3/2 BRE (PV −15 %) lame_rouillee 1 · mort-vivant · contondant −30, sacré −40 · **maladie** · emploi, lame_saignante, non_mort · Os poli — **Goules** (`goules`) 2/2 BET coutelas 1 · mort-vivant · maladie 40, sacré −30 · morsure, putrefaction, non_mort · Os poli, Linceul — **Chien squelette** (`chien_squelette`) 1/1 BET crocs 1 · mort-vivant · contondant −30 · **maladie** · morsure, bond, non_mort · Os poli — **Spectre** (`spectre`) 1/2 MYS mains_spectrales 3 · esprit · tranchant 40, sacré −40 · **maladie** · emploi, murmure, toucher_tombe · Linceul, Cendre funéraire.
Lourds : **Nécromant** (`necromant`) 1/2 OCC baton_os 3 · humain · ténèbres 40 · emploi, drain_ame, peste, malefice · Crâne de nécromant, Cendre funéraire — **Vampire mineur** (`vampire`) 1/2 BRE (OMB +3) lame_rouillee 1 · mort-vivant · ténèbres 40, sacré −40 · emploi, lame_ombre, drain_ame, non_mort · Cendre funéraire, Clou de cercueil — **Fossoyeur dément** (`fossoyeur`) 1/3 BRU pioche 1 · humain · ténèbres 20 · emploi, frappe_brutale, pacte_sang · Clou de cercueil — **Banshee** (`banshee`) 1/2 MYS mains_spectrales 3 · esprit · tranchant 40, sacré −40 · **psychique** · emploi, hurlement_mental, vision_terreur · Linceul, Crâne de nécromant.

### 7.6 Bois d'Ambre (11)
Légers : **Sylphes** (`sylphes`) 3/2 MYS (PV −20 %) bec 2 · fée · psychique 20 · emploi, mirage · Cire de guêpe — **Guêpes d'ambre** (`guepes`) 3/2 BET (PV −25 %) dard 1 · bête · maladie 30 · morsure_venin · Cire de guêpe, Ambre brut — **Cerf d'ambre** (`cerf_ambre`) 1/2 BET (PV +15 %) crocs 1 · bête · — · morsure, charge, repos · Bois de cerf — **Archers sylvains** (`archers_sylvains`) 2/2 TIR arc_m 3 · plante · maladie 20 · tir_arc, tir_empoisonne, repos · Écorce rousse.
Lourds : **Ours-chêne** (`ours_chene`) 1/3 BRU branches 1 · plante, bête · tranchant 20, feu −30 · morsure, pietinement, carapace_epines · Écorce rousse, Cœur de dryade — **Dryade corrompue** (`dryade_corrompue`) 1/2 PRE baton_m 3 · plante · maladie 40, feu −30 · emploi, seve, peste, meditation · Cœur de dryade, Ambre brut — **Druide noir** (`druide_noir`) 1/2 OCC baton_m 3 · humain · maladie 30 · emploi, putrefaction, malefice, jet_toile · Ambre brut — **Tréant mineur** (`treant`) 1/3 CON branches 1 · plante · tranchant 30, maladie 40, feu −40 · **maladie** · emploi, pietinement, riposte · Écorce rousse, Bois de cerf.

### 7.7 Pics de Givre (12)
Légers : **Loups blancs** (`loups_blancs`) 2/2 BET crocs_gris 1 · bête · glace 40, feu −20 · morsure, bond, hurlement · Fourrure de yéti — **Harpies des neiges** (`harpies_neiges`) 3/2 BET (PV −20 %) griffes_m 1 · bête · glace 30 · morsure, cri_effroi · Corne de bélier blanc — **Nains du givre** (`nains_givre_m`) 2/2 REM hache2m 1 · nain · glace 30 · emploi, cri_defi, frappe_brutale · Fer gelé — **Chamane du givre** (`chamane_givre`) 1/2 MAG baton_m 3 · humain · glace 40 · emploi, javelot_glace, prison_glace, meditation · Cristal de givre.
Lourds : **Yéti** (`yeti_m`) 1/3 BRU griffes_m 1 · bête · glace 60, feu −30 · **glace** · morsure, frappe_brutale, pietinement · Fourrure de yéti, Larme du glacier — **Géant du givre** (`geant_givre`) 1/3 CON (PV +10 %) poing_pierre 1 · géant · glace 60, feu −20 · **glace** · emploi, pietinement, coup_assommant, souffle_glacial · Fer gelé, Larme du glacier — **Élémentaire de glace** (`elem_glace`) 1/2 ELM mains_spectrales 2 · élémentaire · glace 75, feu −40 · **glace** · emploi, blizzard, armure_givre · Cristal de givre — **Wendigo** (`wendigo`) 1/2 BRE (OMB +4) griffes_m 1 · esprit · glace 40, sacré −30 · emploi, drain_ame, laceration, cri_effroi · Corne de bélier blanc, Cristal de givre.

### 7.8 Forêt de Sombrefonds (13)
Légers : **Champignons-spores** (`spores`) 3/2 REM (PV −20 %) branches 1 · plante · maladie 60, feu −30 · **maladie** · emploi, nuage · Spores luisantes — **Elfes noirs bretteurs** (`elfes_noirs`) 2/2 BRE dague 1 · elfe · ténèbres 30, sacré −20 · emploi, laceration, lame_ombre · Soie noire — **Chasseresse noire** (`chasseresse_noire`) 1/1 TIR arc_m 3 · elfe · ténèbres 30 · tir_arc, tir_empoisonne, marque · Bois de nuit — **Mangeur de lanternes** (`mangeur_lanternes`) 1/2 MYS mains_spectrales 2 · esprit · ténèbres 30, sacré −40 · emploi, sommeil, drain_ame · Spores luisantes, Bois de nuit.
Lourds : **Araignée géante** (`araignee_geante`) 1/3 BET (PV +30 %) chelicères 1 · bête · maladie 50, feu −30 · morsure_venin, jet_toile, peste, bond · Chitine d'araignée, Soie noire — **Tisseuse de nuit** (`tisseuse_nuit`) 1/2 OCC baton_m 3 · elfe · ténèbres 40 · emploi, malefice, silence_tombe, nuee_ombres · Œil de matriarche, Soie noire — **Ombre rampante** (`ombre_rampante`) 1/2 ELM mains_spectrales 1 · esprit · tranchant 30, sacré −50 · **ténèbres** · emploi, toucher_tombe, mirage · Bois de nuit — **Ours-chancre** (`ours_chancre`) 1/3 BRU griffes_m 1 · bête · maladie 40 · morsure, putrefaction, pietinement · Chitine d'araignée, Spores luisantes.

### 7.9 Hautes-Fumeroles (14)
Légers : **Diablotins** (`diablotins`) 3/2 MAG (PV −20 %) souffle 2 · démon · feu 50, sacré −30 · **feu** · emploi, trait_flammes · Soufre ardent — **Vers de magma** (`vers_magma`) 2/2 BET machoires 1 · bête · feu 60, glace −30 · morsure, lame_ardente · Basalte, Écaille de salamandre — **Salamandre de lave** (`salamandre_lave`) 1/2 BET (ÉLÉ +3) souffle 1 · reptile · feu 60, glace −30 · **feu** · morsure, souffle_feu, repos · Écaille de salamandre — **Pyromancienne cultiste** (`pyromancienne`) 1/2 MAG baton_m 3 · humain · feu 40 · emploi, lance_feu, nova_flammes, meditation · Soufre ardent.
Lourds : **Élémentaire de feu** (`elem_feu`) 1/2 ELM souffle 2 · élémentaire · feu 75, glace −40 · **feu** · emploi, lance_feu, bouclier_flammes, jet_magma · Braise éternelle — **Golem de basalte** (`golem_basalte`) 1/3 CON poing_pierre 1 · construct · tranchant 30, contondant 30, feu 50 · emploi, pietinement, peau_dure · Basalte, Fer de lave — **Chiens infernaux** (`chiens_infernaux`) 2/2 BET crocs 1 · démon, bête · feu 50, sacré −30 · **feu** · morsure, souffle_feu, bond · Écaille de salamandre, Soufre ardent — **Forgeron démoniaque** (`forgeron_demon`) 1/3 BRU masse_lourde 1 · démon · feu 50, sacré −30 · emploi, lame_ardente, frappe_brutale, rage · Fer de lave, Braise éternelle.

### 7.10 Archipel des Naufrageurs (15)
Légers : **Pirates** (`pirates`) 2/2 BRE epee 1 · humain · — · emploi, enchainement, repos · Toile de voile — **Canonniers** (`canonniers`) 2/2 TIR arbalete 3 · humain · feu 20 · tir_arc, jet_magma, repos · Poudre noire — **Crabes géants** (`crabes_geants`) 2/2 REM griffes_m 1 · bête · tranchant 30, contondant 20 · morsure, provocation, carapace_epines · Corail rouge — **Noyé corsaire** (`noye_corsaire`) 2/2 BRE lame_rouillee 1 · mort-vivant · maladie 50, sacré −40 · **maladie** · emploi, lame_saignante, non_mort · Toile de voile, Corail rouge.
Lourds : **Naga** (`naga_m`) 1/2 MAG harpon_m 2 · reptile · glace 40 · emploi, javelot_glace, toucher_tombe, blizzard · Écaille de naga, Perle de kraken — **Sirène corsaire** (`sirene_corsaire`) 1/2 MYS dague 3 · esprit · psychique 40 · emploi, domination, sommeil · Corail rouge — **Requins-garous** (`requins_garous`) 1/2 BRE (PV +20 %) machoires 1 · bête, poisson · glace 30 · morsure, laceration, predateur · Écaille de naga — **Kraken juvénile** (`kraken_juv`) 1/3 BRU (PV +15 %) machoires 1 · bête · glace 40 · **glace** · morsure, harpon_tir, pietinement · Perle de kraken, Poudre noire.

### 7.11 Jungle de Verdeloin (16)
Légers : **Moustiques géants** (`moustiques_geants`) 3/2 BET (PV −30 %) dard 1 · bête · maladie 40 · morsure_venin, toucher_spectral · Venin d'émeraude — **Sarbacaniers** (`sarbacaniers`) 2/2 TIR dard_s 3 · humain · maladie 30 · tir_fronde, tir_empoisonne, repos · Liane de fer — **Hommes-fauves** (`hommes_fauves`) 2/2 BRE griffes_m 1 · humain, bête · — · morsure, bond, laceration · Bois de teck — **Plante carnivore** (`plante_carnivore`) 1/2 REM (vit +3) machoires 1 · plante · maladie 50, feu −40 · **maladie** · morsure, jet_toile, carapace_epines · Liane de fer, Venin d'émeraude.
Lourds : **Serpent-roi** (`serpent_roi`) 1/3 BET (PV +30 %) dard 1 · reptile · maladie 50 · morsure_venin, domination, bond · Venin d'émeraude, Œil de jade — **Chamane-crapaud** (`chamane_crapaud_m`) 1/2 OCC baton_m 3 · reptile · maladie 50 · emploi, peste, malefice, soin_mineur · Venin d'émeraude — **Gorille de guerre** (`gorille_m`) 1/3 BRU poing_pierre 1 · bête · contondant 20 · emploi, frappe_brutale, pietinement, rage · Bois de teck — **Idole de jade** (`idole_jade`) 1/2 CON poing_pierre 1 · construct · tranchant 30, contondant 30, sacré 30 · **psychique** · emploi, coup_assommant, egide · Jade brut, Œil de jade.

### 7.12 Steppes de Khar (17)
Légers : **Hyènes** (`hyenes_m`) 3/2 BET (PV −15 %) crocs 1 · bête · maladie 20 · morsure, laceration · Corne de hyène — **Orcs pillards** (`orcs_pillards`) 2/2 BRU (PV −20 %) lame_rouillee 1 · orc · — · emploi, frappe_brutale, rage · Fer orc — **Centaures archers** (`centaures`) 1/2 TIR (PV +20 %) arc_m 3 · centaure · — · tir_arc, rafale, repos · Cuir de centaure — **Harpies tempête** (`harpies_tempete`) 3/2 BET (PV −20 %, vit −2) griffes_m 1 · bête · glace 30 · morsure, cri_effroi, mirage · Herbe à vent.
Lourds : **Chef de guerre orc** (`chef_orc`) 1/3 REM (FOR +4) epee 1 · orc · tranchant 20 · emploi, cri_guerre, enchainement, rempart_vivant · Fer orc, Totem du vent — **Chamane orc** (`chamane_orc`) 1/2 PRE baton_m 3 · orc · psychique 20 · emploi, mains_lumiere, chant_guerre, onde_mentale · Totem du vent — **Géant des steppes** (`geant_steppes`) 1/3 CON (PV +10 %) poing_pierre 1 · géant · contondant 30 · emploi, pietinement, frappe_brutale · Cuir de centaure, Corne de hyène — **Esprit du vent** (`esprit_vent`) 1/2 ELM mains_spectrales 2 · élémentaire · glace 50, tranchant 20 · **psychique** · emploi, blizzard, mirage, hurlement_mental · Herbe à vent.

### 7.13 Abysses d'Ys (18)
Légers : **Hommes-poissons** (`hommes_poissons_m`) 2/2 BRE harpon_m 1 · poisson · glace 30 · emploi, harpon_tir, enchainement · Algue d'Ys — **Méduses géantes** (`meduses_m`) 3/2 OCC (PV −20 %) dard 2 · bête · glace 30, psychique 30 · **psychique** · emploi, putrefaction, toucher_tombe · Encre de pieuvre — **Anguilles-tonnerre** (`anguilles`) 2/2 BET (ÉLÉ +3) machoires 1 · poisson · glace 40 · morsure, coup_assommant, bond · Nacre abyssale — **Garde engloutie** (`garde_engloutie`) 2/2 REM epee 1 · mort-vivant · maladie 50, glace 30, sacré −40 · **maladie** · emploi, cri_defi, rempart_vivant, non_mort · Algue d'Ys, Nacre abyssale.
Lourds : **Sirènes abyssales** (`sirenes_abyssales`) 1/2 MYS mains_spectrales 3 · esprit · psychique 50 · emploi, hurlement_mental, domination, sommeil · Perle d'Ys, Encre de pieuvre — **Oracle noyé** (`oracle_noye`) 1/2 OCC baton_m 3 · mort-vivant · ténèbres 40, glace 30 · emploi, drain_ame, nuee_ombres, silence_tombe · Encre de pieuvre — **Léviathan juvénile** (`leviathan_juv`) 1/3 BRU (PV +25 %) machoires 1 · bête · glace 50 · **glace** · morsure, pietinement, souffle_glacial · Dent de léviathan, Perle d'Ys — **Horreur des profondeurs** (`horreur`) 1/3 CON (ESP +5) machoires 1 · aberration · psychique 60, ténèbres 30 · **psychique** · emploi, hurlement_mental, vision_terreur, pietinement · Dent de léviathan, Nacre abyssale.

### 7.14 Marches d'Obsidienne (19)
Légers : **Démons mineurs** (`demons_mineurs`) 3/2 BRE (PV −20 %) griffes_m 1 · démon · feu 50, sacré −40 · **feu** · emploi, lame_ardente, laceration · Sang de démon — **Archers d'obsidienne** (`archers_obsidienne`) 2/2 TIR arc_m 3 · démon · feu 30, sacré −30 · tir_arc, rafale, marque_mort · Obsidienne — **Molosse infernal** (`molosse_infernal`) 1/2 BET (PV +15 %) crocs 1 · démon, bête · feu 60, sacré −30 · **feu** · morsure, souffle_feu, bond, predateur · Cuir infernal — **Succube** (`succube_m`) 1/2 MYS dague 2 · démon · feu 40, sacré −30 · emploi, domination, drain_ame · Sang de démon, Chaîne d'âme.
Lourds : **Chevalier infernal** (`chevalier_infernal`) 1/3 REM (FOR +4) epee 1 · démon · feu 50, tranchant 20, sacré −30 · **feu** · emploi, provocation, enchainement, rempart_vivant · Obsidienne, Cœur de démon — **Sorcier abyssal** (`sorcier_abyssal`) 1/2 OCC baton_m 3 · démon · ténèbres 50, sacré −40 · emploi, nuee_ombres, malefice, pacte_sang · Chaîne d'âme, Sang de démon — **Inquisiteur déchu** (`inquisiteur_dechu`) 1/2 PRE (OMB +4) sceptre 3 · humain · ténèbres 40, sacré 20 · emploi, jugement, drain_ame, egide · Chaîne d'âme — **Balrog mineur** (`balrog`) 1/3 BRU (PV +20 %, ÉLÉ +4) masse_lourde 1 · démon · feu 70, sacré −30 · **feu** · emploi, meteore, frappe_brutale, nova_flammes · Cœur de démon, Obsidienne.

### 7.15 Bois-Songe (20)
Légers : **Fées du rêve** (`fees_reve`) 3/2 MYS (PV −25 %) bec 2 · fée · psychique 50 · **psychique** · emploi, sommeil, mirage · Pétale de lune — **Archères de rosée** (`archeres_rosee_m`) 2/2 TIR arc_m 3 · fée · psychique 20 · tir_arc, rafale, fleche_givre · Bois d'argent — **Chevaliers de lune** (`chevaliers_lune_m`) 2/2 REM epee 1 · fée · psychique 30 · emploi, cri_defi, chatiment · Soie de rêve — **Licorne noire** (`licorne_noire`) 1/2 BET (PV +20 %, OMB +3) crocs 1 · bête, fée · ténèbres 40, sacré −20 · morsure, charge, drain_ame · Corne de licorne.
Lourds : **Cauchemar** (`cauchemar`) 1/2 ELM mains_spectrales 2 · esprit · ténèbres 40, sacré −40 · **psychique** · emploi, vision_terreur, terreur_masse, drain_ame · Larme de songe, Soie de rêve — **Mangeur de rêves** (`mangeur_reves`) 1/3 MYS (PV +20 %) machoires 2 · aberration · psychique 60 · emploi, hurlement_mental, domination, sommeil · Larme de songe — **Dormeur** (`dormeur_m`) 1/3 CON poing_pierre 1 · géant · psychique 40, contondant 20 · emploi, pietinement, sommeil, frappe_brutale · Bois d'argent, Pétale de lune — **Sylve songeuse** (`sylve_songeuse`) 1/2 PRE baton_m 3 · plante, fée · psychique 30, maladie 30 · emploi, onde_soin, egide, clarte · Pétale de lune, Larme de songe.

---

## 8. Monstres et boss de donjon

Monstres spéciaux : gabarit indiqué, rang et capacités ; ils laissent le matériau de leur donjon (contenu-cible-monde.md, section 3). Boss : gabarit BOS, population 4 (salles 4 et 8) puis 5 au-delà [H], immunités, capacités, et toujours leur **trophée de boss**.

| Donjon | Monstres spéciaux (gabarit · capacités) | Boss (immunité · capacités) |
|---|---|---|
| Terriers du Roi Kobold | Kobolds terrassiers 3/2 BRE · emploi, laceration ; Kobolds lance-pierres 2/2 TIR · tir_fronde, filet ; Taupes géantes 1/2 BET · morsure, pietinement ; Kobold géomancien 1/2 MAG · jet_magma, peau_ecorce | Taupe-Reine (— · morsure, pietinement, frappe_brutale, repos) ; Chef terrassier Gratte-Gratte (— · emploi, enchainement, cri_defi, coup_assommant) ; Roi Kobold Mille-Galeries (psychique · emploi, chant_guerre, jet_magma, egide, enchainement) |
| Tertre des Fées | Farfadets voleurs 3/2 MYS · confusion, mirage ; Lutins de tourbe 2/2 BRE · laceration, brise_genou ; Feux follets dansants 2/2 ELM · trait_flammes, mirage (immunité feu) ; Champignons-fées 1/2 PRE · seve, sommeil | Lutin Grand-Chapeau (psychique · domination, sommeil, mirage) ; Fée Mélancolie (psychique · vision_terreur, hurlement_mental, onde_soin) ; Roi des Elfes du Tertre (psychique · domination, javelot_glace, egide, onde_mentale, enchainement) |
| Grotte des Contrebandiers | Contrebandiers 2/2 BRE · enchainement, laceration ; Chiens de garde 2/2 BET · morsure, bond ; Noyés du port 3/2 BRE · lame_saignante (immunité maladie) ; Sorcière des quais 1/2 OCC · malefice, putrefaction | Le Borgne Main-Leste (— · estoc, enchainement, mirage, predateur) ; Grosse Berthe la Cantinière (— · frappe_brutale, pietinement, mains_lumiere, cri_defi) ; Capitaine Corbac (maladie · carreau_lourd, cri_guerre, drain_ame, marque_mort, enchainement) |
| Crypte des Corbeaux | Squelettes corbeaux 3/2 BRE · laceration (maladie) ; Goules de crypte 2/2 BET · morsure, putrefaction ; Prêtres cadavériques 1/2 OCC · drain_ame, silence_tombe ; Nuée de corbeaux morts 3/2 BET · morsure, cri_effroi (maladie) | Gardien des os (maladie · frappe_brutale, rempart_vivant, peau_dure) ; Abbesse Plume-Noire (maladie · nuee_ombres, malefice, onde_soin) ; Roi Corbeau (maladie · nuee_ombres, marque_mort, bond, cri_effroi, drain_ame) |
| Puits sans fond | Nains revenants 2/2 REM · frappe_brutale (maladie) ; Golems de fer rouillé 1/3 CON · pietinement, peau_dure ; Vers aveugles 2/2 BET · morsure, bond ; Kobolds fous 3/2 BRE · laceration, pacte_sang | Contremaître éternel (maladie · cri_guerre, frappe_brutale, enchainement) ; Golem-Forge primitif (feu · jet_magma, pietinement, bouclier_flammes) ; L'Ombre du Puits (ténèbres · nuee_ombres, sommeil, drain_ame, silence_tombe, mirage) |
| Ruche de cristal | Guêpes de cristal 3/2 BET · morsure_venin ; Larves luisantes 2/2 OCC · putrefaction ; Ouvrières de quartz 2/2 REM · provocation, carapace_epines ; Sentinelles prismatiques 1/2 ELM · javelot_glace, armure_givre (immunité glace) | Bourdon de quartz (maladie · morsure_venin, bond, peste) ; Princesse-Prisme (glace · blizzard, prison_glace, egide) ; Reine de cristal (glace · meteore, blizzard, peste, onde_soin, domination) |
| Tombeau du Roi des Glaces | Guerriers gelés 2/2 REM · enchainement (glace) ; Spectres de givre 2/2 MYS · toucher_tombe, vision_terreur ; Loups de glace 2/2 BET · morsure, bond ; Prêtresses de l'hiver 1/2 PRE · mains_lumiere, armure_givre | Chancelier de Givre (glace · prison_glace, malefice, egide) ; Reine Hiver-Pâle (glace · blizzard, sommeil, onde_soin) ; Roi des Glaces (glace · souffle_glacial, prison_glace, frappe_brutale, rempart_vivant, meteore) |
| Épave du Léviathan | Marins maudits 3/2 BRE · lame_saignante (maladie) ; Crabes d'abysse 2/2 REM · carapace_epines, provocation ; Murènes géantes 1/2 BET · morsure, bond ; Sorciers des marées 1/2 MAG · javelot_glace, blizzard | Bosco Noyé (maladie · enchainement, cri_defi, harpon_tir) ; Sorcière Mare-Noire (glace · blizzard, drain_ame, malefice) ; Cœur du Léviathan (glace · souffle_glacial, pietinement, hurlement_mental, peau_dure, rage) |
| Pyramide de Jade | Momies de jade 2/2 REM · putrefaction (maladie) ; Serpents sacrés 2/2 BET · morsure_venin, bond ; Prêtres-jaguars 1/2 PRE · mains_lumiere, chatiment ; Gardiens de pierre 1/3 CON · pietinement (psychique) | Grand Jaguar (— · bond, predateur, enchainement, hurlement) ; Prêtresse Jade-Mort (maladie · peste, onde_soin, domination) ; Dieu-Serpent endormi (psychique · peste, domination, souffle_feu, egide, sommeil) |
| Tour des Vents | Élémentaires d'air 2/2 ELM · mirage, onde_mentale (psychique) ; Harpies de la tour 3/2 BET · cri_effroi, laceration ; Moines du vent 1/2 MYS · enchainement, clarte ; Gargouilles de bronze 2/2 CON · carapace_epines, coup_assommant | Maître des Courants (psychique · mirage, hurlement_mental, lien_esprits) ; Gargouille d'airain (tranchant · pietinement, peau_dure, frappe_brutale) ; Seigneur des Vents (psychique · blizzard, hurlement_mental, mirage, meteore, domination) |
| Observatoire inversé | Astromanciens déments 1/2 MAG · blizzard, mot_silence ; Étoiles déchues 2/2 ELM · lance_feu (feu) ; Golems d'orrery 1/3 CON · pietinement, peau_dure ; Anges sans visage 1/2 PRE · jugement, egide | Gardien de l'Orrery (psychique · pietinement, frappe_brutale, aura_protection) ; Astronome Vide-d'Yeux (psychique · meteore, prison_glace, sommeil) ; L'Étoile Noire (ténèbres · meteore, nuee_ombres, silence_tombe, egide, hurlement_mental) |
| Abîme d'Obsidienne | Démons du verre 3/2 BRE · lame_ardente (feu) ; Âmes captives 2/2 MYS · vision_terreur, drain_ame ; Molosses d'obsidienne 2/2 BET · souffle_feu, bond (feu) ; Sorciers du gouffre 1/2 OCC · nuee_ombres, malefice | Geôlier des Âmes (ténèbres · filet, silence_tombe, frappe_brutale) ; Duchesse de Verre (feu · meteore, domination, bouclier_flammes) ; Prince de l'Abîme (feu · meteore, nuee_ombres, enchainement, rempart_vivant, drain_ame) |

---

## 9. Équipement

### 9.1 Pools de stats avec les puissances

| Catégorie | Pool (poids) |
|---|---|
| Une main (lame), deux mains, gantelets, fronde, arc | FOR 3, dégâts d'arme 3, vitesse d'arme 1, coût d'arme 2, énergie 1 (+ volonté 1 pour masse et gantelets, PV 1 pour deux mains) |
| Masse | FOR 2, FOI 1, dégâts d'arme 2, vitesse 1, coût 2, volonté 1 |
| Bâton | ÉLÉ 2, OMB 2, ESP 1, mana 3, volonté 2, résistance 1 |
| Sceptre (nouvelle base, arme une main) | FOI 3, mana 2, volonté 2, résistance 1 |
| **Orbe** (nouvelle catégorie, arme une main des lanceurs) | ÉLÉ 2, OMB 2, ESP 2, mana 3, volonté 1 |
| Armures légère, moyenne, lourde | inchangées (PV, résistances, énergie, volonté) |
| Robe | mana 3, volonté 2, ÉLÉ 1, OMB 1, FOI 1, PV 1, résistance 1 |
| Bottes | PV 2, énergie 2, résistance contondant 1, volonté 1 |
| Anneau | mana 2, volonté 2, FOR 1, ÉLÉ 1, OMB 1, résistance 2 |
| Collier | FOR 2, PV 2, énergie 1, résistance 1 |
| **Talisman** (nouvelle catégorie, accessoire) | FOI 3, ESP 2, volonté 2, mana 1, résistance 1 |

Arme naturelle nouvelle `orbe` (Orbe, psychique, dégâts 6, vitesse 22, coût 6) pour les troupes qui en portent une de base.

Nouvelles bases générées comme aujourd'hui (5 paliers par catégorie, budget et valeur du palier) : Orbe (Orbe de verre, Orbe de brume, Orbe de cristal, Orbe de braise, Orbe stellaire), Sceptre (Sceptre de bois, Sceptre d'ambre, Sceptre runique, Sceptre solaire, Sceptre de l'aube), Talisman (Talisman de bois, Talisman d'os, Talisman d'argent, Talisman de jade, Talisman d'aube). Ajout des emplacements : les types de gabarit MAG, OCC, MYS acceptent l'orbe ; PRE accepte le sceptre ; MAG, OCC, MYS, PRE acceptent le talisman.

### 9.2 Bases signatures des régions nouvelles (fabricables dans la ville de leur région seulement, palier de la région)

| Région | Base | Emplacement | Pool marquant |
|---|---|---|---|
| Val-Moussu | Fourche du meunier | deux mains | FOR, PV, dégâts |
| Saulnes | Collier de galets chantants | accessoire (collier) | ESP, volonté, rés. glace |
| Fort-Bruyère | Brigandine de bruyère | armure moyenne | PV, rés. tranchant, énergie |
| Brumefosse | Cape de brume | armure légère | ESP, rés. psychique, énergie |
| Corbeval | Linceul consacré | robe | FOI, rés. ténèbres, mana |
| Ambrerive | Arc d'ambre | arc | FOR, dégâts, rés. maladie |
| Givrecime | Hache du givre | deux mains | FOR, dégâts (type glace), rés. glace |
| Lanterne-Noire | Dague de nuit | une main | FOR, OMB, vitesse (type ténèbres) |
| Braise-Haute | Marteau de lave | une main (masse) | FOR, ÉLÉ (type feu), rés. feu |
| Port-Corsaire | Tricorne du capitaine | accessoire (anneau) | FOR, volonté, ESP |
| Verdeloin | Masque de chamane | accessoire (talisman) | OMB, FOI, rés. maladie |
| Kharak | Arc des steppes | arc | FOR, vitesse, énergie |
| Ys-la-Profonde | Orbe des abysses | orbe | ESP, OMB, rés. glace |
| Citadelle d'Obsidienne | Armure d'obsidienne | armure lourde | PV, rés. feu, rés. tranchant |
| Lune-Dormante | Talisman de lune | talisman | ESP, FOI, volonté |

### 9.3 Objets uniques de donjon

24 bases non fabricables (2 par donjon, liste dans contenu-cible-monde.md section 3), du palier de leur donjon, avec **une stat de plus** que leur palier (`nStats + 1`), un budget × 1,25 et une propriété fixe en plus des stats tirées [H] : par exemple « Couronne de givre : immunise contre le Gel », « Sabre du Capitaine : Enchaînement coûte 5 énergie de moins », « Masque de corbeau : +10 % de dégâts sur une cible marquée », « Lame d'âmes : chaque ennemi tué rend 40 PV ». La liste exacte des propriétés est à écrire avec Xavier, une par objet.

---

## 10. Consommables

Les potions de PV et de mana et leurs valeurs fixes sont dans le README, section 19.5. S'y ajoutent deux consommables de soutien, vendus par le marchand à partir du palier indiqué, fabricables à l'atelier et vendables entre joueurs. Mêmes règles d'usage que le prototype (entre deux combats, sur une unité précise, README 7.5).

| Objet | Palier | Effet | Valeur |
|---|---|---|---|
| Fiole de vigueur | 2 | +60 énergie | 20 |
| Élixir de résistance (feu, glace, ténèbres, maladie ou psychique) | 3 | +20 % à ce type pour le prochain combat, dans la limite du plafond | 60 |

