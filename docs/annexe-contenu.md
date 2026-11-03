# Annexe : contenu du prototype « Les Cinq Régions »

Généré automatiquement depuis le code (`/mnt/project-files/prototype-ville/src/`) le 3 novembre 2026, moteur `proto-0.4-ville`. Valeurs **brutes** du contenu : les multiplicateurs (jauges ×3, bonus d’objet ×2, renfort des monstres par région, +2 niveaux) sont appliqués au calcul, voir le README section 4 et 9.

Notation des stats : PV / volonté / énergie / mana / attaque. Croissance = gain par niveau (arrondi à l’entier inférieur sur le cumul : `base + floor(croissance × (niveau − 1))`). Résistances en %.

## A. Armes naturelles (sans équipement)

| id | Nom | Type | Dégâts | Vitesse | Coût énergie |
|---|---|---|---|---|---|
| epee | Épée courte | tranchant | 12 | 20 | 10 |
| fronde | Fronde | contondant | 8 | 18 | 8 |
| masse | Masse de prêtre | contondant | 6 | 22 | 6 |
| baton | Bâton | contondant | 6 | 22 | 6 |
| arc | Arc | tranchant | 10 | 18 | 10 |
| hache2m | Hache à deux mains | tranchant | 16 | 24 | 14 |
| crocs | Crocs | tranchant | 10 | 14 | 8 |
| gantelets | Gantelets | contondant | 8 | 14 | 6 |
| masse_lourde | Masse lourde | contondant | 18 | 30 | 15 |
| coutelas | Coutelas ébréché | tranchant | 8 | 17 | 7 |
| fronde_gob | Fronde de gobelin | contondant | 6 | 18 | 7 |
| crocs_gris | Crocs | tranchant | 9 | 15 | 8 |
| chelicères | Chélicères | maladie | 8 | 17 | 8 |
| baton_os | Bâton d'os | contondant | 5 | 22 | 6 |
| gourdin | Gourdin | contondant | 15 | 27 | 13 |
| branches | Branches | contondant | 16 | 26 | 12 |
| griffes_m | Griffes | tranchant | 10 | 15 | 8 |
| dard | Dard | maladie | 9 | 16 | 8 |
| lame_rouillee | Lame rouillée | tranchant | 11 | 19 | 9 |
| poing_pierre | Poings de pierre | contondant | 16 | 26 | 12 |
| harpon_m | Harpon | tranchant | 12 | 20 | 10 |
| baton_m | Bâton tordu | contondant | 6 | 22 | 6 |
| arc_m | Arc court | tranchant | 11 | 18 | 10 |
| bec | Bec | tranchant | 8 | 14 | 6 |
| mains_spectrales | Mains spectrales | tenebres | 9 | 18 | 7 |
| lame_lumiere | Lame de lumière | sacre | 14 | 20 | 10 |
| machoires | Mâchoires | tranchant | 15 | 22 | 12 |
| souffle | Souffle brûlant | feu | 12 | 20 | 10 |
| lance | Lance | tranchant | 13 | 21 | 11 |
| dague | Dague | tranchant | 9 | 14 | 6 |
| arbalete | Arbalète | tranchant | 15 | 24 | 12 |
| griffes | Griffes de combat | tranchant | 9 | 13 | 6 |
| sceptre | Sceptre | sacre | 7 | 22 | 6 |
| pioche | Pioche | contondant | 12 | 21 | 10 |
| flasques | Flasques | feu | 7 | 18 | 7 |
| dard_s | Dards | maladie | 9 | 15 | 7 |

## B. Capacités (92)

« Moteur » = effet codé en dur dans `engine.ts` (resolve) ; « fx » = effet décrit par des données (liste d’effets génériques). Portée : ennemi = distance d(A,B), allié = écart de rang. Durée = multiplicateur (‰) de la vitesse de l’unité ou de l’arme. Énergie W = ‰ du coût de l’arme.

| id | Nom | Genre | Cible | Portée | Énergie | Mana | Durée | Type | Effet | Codage |
|---|---|---|---|---|---|---|---|---|---|---|
| emploi | Emploi d'arme | active | enemy | 1 | W×1 | 0 | arme ×1 | weapon, attaque, contact | 1x dégâts de l'arme. DE : un autre ennemi. EC : se frappe. | moteur |
| exploit | Exploit d'arme | active | enemy | 1 | W×2 | 0 | arme ×1.5 | weapon, attaque, contact | 2x dégâts + spécial (Saignement si tranchant, Étourdi si contondant). DE : rien. EC : frappe un allié. | moteur {mult:2000,bleed:4,bleedDur:60,stun:20} |
| meditation | Méditation | active | self | 1 | 10 | 0 | unité ×2 | — | +20 % de volonté. DE : +5 %. EC : perd 10 % de PV. | moteur {ok:200,half:50,crit:100} |
| repos | Repos | active | self | 1 | 0 | 0 | unité ×1 | — | +10 % d'énergie. DE : rien. EC : perd 7,5 % de PV. | moteur {ok:100,crit:75} |
| coup_bouclier | Coup de bouclier | active | enemy | 1 | 15 | 0 | arme ×1 | contondant, attaque, contact | 0,5x dégâts + Étourdi 30. DE : sans étourdir. EC : s’étourdit. | moteur {mult:500,stun:30} |
| repousser | Repousser | active | enemy | 1 | 15 | 0 | arme ×1 | contondant, attaque, contact | 0,5x dégâts, la cible recule (Étourdi 30 si déjà à 3). DE : sans recul. EC : le lanceur recule. | moteur {mult:500,stun:30} |
| repousser_renforce | Repousser renforcé | active | self | 1 | 20 | 0 | arme ×1 | contondant, contact | Repousser sur tous les ennemis au contact. | moteur {mult:500,stun:30} |
| provocation | Provocation | active | self | 1 | 15 | 0 | unité ×1 | — | Les attaques ennemies doivent le viser s’il est à portée, 60 instants. DE : 30. EC : −15 % de volonté. | moteur {dur:60,halfDur:30,crit:150} |
| riposte | Riposte | reaction | self | 1 | 10 | 0 | unité ×1 | — | Réaction : touché au corps à corps, contre-attaque à 0,5x (10 énergie). | moteur {mult:500} |
| dernier_rempart | Dernier rempart | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif, une fois : un allié du même rang qui devrait mourir reste à 1 PV ; −20 % de volonté. | moteur {will:200} |
| mur_boucliers | Mur de boucliers | active | self | 1 | 25 | 0 | unité ×2 | — | Bouclier de 25 aux alliés de son rang, 80 instants. DE : sur lui seul. | moteur {shield:25,dur:80} |
| execution | Exécution | active | enemy | 1 | 25 | 0 | arme ×1.5 | tranchant, attaque, contact | 1x dégâts, triplés sous 25 % de PV. DE : rien. EC : frappe un allié. | moteur {threshold:250,bonusMult:3000} |
| fracas | Fracas | active | enemy | 1 | 20 | 0 | arme ×1.5 | contondant, attaque, contact | 1x dégâts, triplés si la cible est Gelée (brise le gel). DE : 0,5x. EC : frappe un allié. | moteur {half:500,bonusMult:3000} |
| brise_armure | Brise-armure | active | enemy | 1 | 15 | 0 | arme ×1 | tranchant, attaque, contact | 0,5x dégâts et −20 % de résistance physique, cumulable 3. DE : sans l’affaiblissement. EC : sur soi. | moteur {mult:500,res:200,cap:3,dur:100} |
| charge | Charge | active | enemy | 2-4 | 25 | 0 | unité ×1.5 | contondant, attaque, contact | Avance au rang 1 et frappe à 1,5x. DE : avance sans frapper. EC : avance et s’étourdit. | moteur {mult:1500,stun:20} |
| tir_fronde | Tir de fronde | active | enemy | 3 | W×1 | 0 | arme ×1 | weapon, attaque | 1x dégâts de l'arme, portée 3. DE : autre ennemi. EC : touche un allié. | moteur |
| volee | Volée | active | enemy | 4 | 30 | 0 | arme ×2 | weapon, attaque | 0,6x dégâts à tout un rang. DE : une seule unité. EC : rien. | moteur {mult:600} |
| tir_arc | Tir à l'arc | active | enemy | 4 | W×1 | 0 | arme ×1 | weapon, attaque | 1x dégâts de l'arme, portée 4. DE : autre ennemi. EC : touche un allié. | moteur |
| tir_precis | Tir précis | active | enemy | 5 | 25 | 0 | arme ×2 | weapon, attaque | 2x dégâts, ignore 50 % des résistances. DE : 1x. EC : rien. | moteur {mult:2000} |
| marque | Marque du chasseur | active | enemy | 5 | 10 | 0 | unité ×1 | — | Les 3 prochaines attaques alliées sur la cible font +30 %. DE : 1 attaque. EC : sur un allié. | moteur {uses:3,dur:100,bonus:300} |
| soin_mineur | Soin mineur | active | ally | 2 | 0 | 8 | unité ×1 | — | +25 % des PV max. DE : +10 %. EC : −10 %. | moteur {ok:250,half:100,crit:100} |
| regeneration | Régénération | active | ally | 2 | 0 | 10 | unité ×1 | — | +3 % des PV max par tic, 100 instants. DE : 50. EC : sur un ennemi. | moteur {perTick:30,dur:100,halfDur:50} |
| priere | Prière collective | active | self | 1 | 0 | 18 | unité ×3 | — | +10 % des PV max à tous les alliés. DE : son rang. EC : −20 % de volonté. | moteur {ok:100,crit:200} |
| purification | Purification | active | ally | 2 | 0 | 10 | unité ×1 | — | Retire les états négatifs. DE : le plus récent. EC : retire les positifs. | moteur |
| trait_sacre | Trait sacré | active | enemy | 5 | 0 | 10 | unité ×1 | —, attaque | 20 dégâts sacrés, x2 contre mort-vivant et démon. DE : moitié. EC : soigne la cible. | moteur {dmg:20,tagMult:2000} |
| trait_sacre_renforce | Trait sacré renforcé | active | enemy | 5 | 0 | 12 | unité ×1 | —, attaque | Trait sacré, x3 contre mort-vivant et démon. | moteur {dmg:20,tagMult:3000} |
| bouclier_foi | Bouclier de foi | active | ally | 2 | 0 | 12 | unité ×1 | — | Bouclier de 40 PV, 100 instants. DE : 15. EC : rien. | moteur {ok:40,half:15,dur:100} |
| aura_serenite | Aura de sérénité | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif : +5 % de volonté par tic aux alliés de son rang. | moteur {will:50} |
| confusion | Confusion | active | enemy | 5 | 0 | 10 | unité ×1 | — | La prochaine action de la cible est un demi-échec. DE : −10 % de volonté. EC : sur soi. | moteur {dur:200,half:100} |
| confusion_moine | Confusion (moine) | active | enemy | 5 | 20 | 0 | unité ×1 | — | Confusion sans mana, 20 énergie. | moteur {dur:200,half:100} |
| trait_flammes | Trait de flammes | active | enemy | 4 | 0 | 5 | unité ×1 | —, attaque | 15 dégâts de feu + Brûlure courte. DE : sans brûlure. EC : Brûlure sur soi. | moteur {dmg:15,burn:6,burnDur:20} |
| boule_feu | Boule de feu | active | enemy | 5 | 0 | 15 | unité ×2 | —, attaque | 30 à la cible, 10 à son rang, Brûlure. DE : autre unité du rang. EC : explose sur son rang. | moteur {dmg:30,splash:10,burn:6,burnDur:40} |
| arme_enflammee | Arme enflammée | active | ally | 1 | 0 | 10 | unité ×1 | — | Les attaques d’arme de l’allié ajoutent 8 feu et Brûlure, 80 instants. DE : 40. EC : Brûlure sur l’allié. | moteur {dur:80,halfDur:40,bonus:8,burn:4,burnDur:40} |
| mur_flammes | Mur de flammes | active | enemy | 5 | 0 | 18 | unité ×2 | — | Brûlure à tout un rang ennemi. DE : une unité. EC : son propre rang. | moteur {burn:6,burnDur:60} |
| embrasement | Embrasement | active | enemy | 5 | 0 | 20 | unité ×2 | — | Chaque ennemi qui brûle subit le double des dégâts de brûlure restants. DE : le plus proche. EC : les alliés. | moteur |
| coeur_ardent | Cœur ardent | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif : dégâts de feu +20 % sur les cibles qui brûlent. | moteur {bonus:200} |
| lame_saignante | Lame saignante | active | enemy | 1 | 15 | 0 | arme ×1 | tranchant, attaque, contact | 0,8x dégâts + Saignement. DE : sans saignement. EC : saigne lui-même. | moteur {mult:800,bleed:5,bleedDur:60} |
| cri_guerre | Cri de guerre | active | self | 1 | 20 | 0 | unité ×1 | — | +20 % de volonté et +10 % d’attaque aux alliés, 80 instants. DE : lui seul. EC : −10 % de volonté. | moteur {will:200,atk:100,dur:80,crit:100} |
| rage | Rage | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif : +2 % d’attaque par 10 % de PV perdus ; ses blessures ne baissent pas sa volonté. | moteur {atkPer10:20} |
| tourbillon | Tourbillon | active | self | 1 | 35 | 0 | arme ×2 | tranchant, contact | 1x dégâts à tous les ennemis au contact. DE : moitié. EC : touche aussi son rang. | moteur {half:500} |
| morsure | Morsure | active | enemy | 1 | W×1 | 0 | arme ×1 | tranchant, attaque, contact | 1x dégâts + Saignement si la cible est sous 50 %. DE : sans saignement. EC : rien. | moteur {threshold:500,bleed:5,bleedDur:60} |
| hurlement | Hurlement | active | self | 1 | 20 | 0 | unité ×1 | — | +15 % de volonté aux alliés, −10 % aux ennemis des rangs 1 et 2. DE : alliés seulement. EC : −10 % aux alliés. | moteur {ally:150,enemy:100,crit:100} |
| instinct_meute | Instinct de meute | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif : +15 % sur une cible déjà attaquée par l’autre loup depuis le dernier tic. | moteur {bonus:150} |
| drain | Drain de vie | active | enemy | 3 | 0 | 12 | unité ×2 | —, attaque | 20 ténèbres, récupère la moitié. DE : sans soin. EC : le lien s’inverse. | moteur {dmg:20,crit:10} |
| murmure | Murmure de terreur | active | enemy | 5 | 0 | 10 | unité ×1 | —, attaque | 10 psychiques et −25 % de volonté. DE : −10 %. EC : −15 % sur soi. | moteur {dmg:10,will:250,half:100,crit:150} |
| terreur_masse | Terreur de masse | active | enemy | 5 | 0 | 18 | unité ×2 | — | Murmure de terreur sur tout un rang. | moteur {dmg:10,will:250,half:100,crit:150} |
| malediction | Malédiction de faiblesse | active | enemy | 5 | 0 | 12 | unité ×2 | — | −25 % de résistance à tout, 80 instants. DE : 40. EC : sur soi. | moteur {res:250,dur:80,halfDur:40} |
| nuage | Nuage pestilentiel | active | enemy | 4 | 0 | 12 | unité ×2 | — | Poison sur un rang (3 par tic, cumulable 3). DE : une unité. EC : son propre rang. | moteur {dmg:3,dur:100,cap:3} |
| nuage_renforce | Nuage renforcé | active | enemy | 4 | 0 | 14 | unité ×2 | — | Nuage pestilentiel, 5 charges max. | moteur {dmg:3,dur:100,cap:5} |
| lien_vital | Lien vital | active | enemy | 4 | 0 | 15 | unité ×2 | — | 30 % des dégâts subis par le lanceur sont renvoyés sur la cible, 60 instants. DE : 30. EC : sens inverse. | moteur {dur:60,halfDur:30,share:300} |
| non_mort | Non-mort | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif : insensible au Poison et au Saignement. | moteur |
| contagion | Contagion | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif : quand un ennemi empoisonné meurt, son poison passe au plus proche. | moteur {cap:5} |
| pieges_glace | Pièges de glace | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif : le premier ennemi qui avance au contact est Ralenti. | moteur {dur:60} |
| esprit_inebranlable | Esprit inébranlable | passive | self | 1 | 0 | 0 | unité ×1 | — | Passif : sa volonté ne descend jamais sous 50 %. | moteur |
| hate | Hâte | active | self | 1 | 25 | 0 | unité ×1 | — | Hâte sur soi, 80 instants. DE : 40. EC : Ralenti. | moteur {dur:80,halfDur:40} |
| paume_vide | Paume du vide | active | enemy | 1 | 30 | 0 | unité ×1.5 | —, attaque, contact | 25 psychiques + Confusion + −20 % de volonté. DE : dégâts seuls. EC : se confond. | moteur {dmg:25,will:200,confDur:200} |
| seisme | Séisme | active | self | 1 | 40 | 0 | unité ×3 | — | 20 dégâts aux ennemis des rangs 1 et 2, Étourdi au contact. DE : sans étourdir. EC : s’étourdit et perd 10 %. | moteur {dmg:20,stun:20,crit:100} |
| fleche_givre | Flèche de givre | active | enemy | 4 | 15 | 0 | arme ×1 | —, attaque | 15 glace + Ralenti ; Gelé 20 si déjà ralenti (pas de nouveau gel sur la même cible pendant 100 instants). DE : Ralenti seul. EC : se ralentit. | moteur {dmg:15,slowDur:60,freezeDur:20,freezeImmune:100} |
| grappin | Grappin | active | enemy | 4 | 20 | 0 | unité ×2 | — | Attire la cible au rang 1. DE : d’un cran. EC : le lanceur est tiré au rang 1. | moteur |
| eclat_glace | Éclat de glace | active | enemy | 4 | 0 | 8 | unité ×1 | —, attaque | 16 glace + Ralenti 40. | fx: dmg 16 glace ; state ralenti dur 40 |
| tempete_givre | Tempête de givre | active | enemy | 5 | 0 | 20 | unité ×2 | —, attaque | 14 glace et Ralenti 60 à tout un rang. | fx: dmg 14 glace @rank ; state ralenti dur 60 @rank |
| pluie_feu | Pluie de feu | active | enemy | 5 | 0 | 24 | unité ×2.5 | —, attaque | 12 feu et Brûlure à tous les ennemis. | fx: dmg 12 feu @allEnemies ; state 4 brulure dur 40 @allEnemies |
| eruption | Éruption | active | enemy | 5 | 0 | 30 | unité ×3 | —, attaque | 24 feu à tous les ennemis, Étourdi 10 aux rangs 1-2. | fx: dmg 24 feu @allEnemies ; stun 10 @front |
| souffle_feu | Souffle de feu | active | enemy | 2 | 30 | 0 | unité ×2 | —, attaque | 18 feu et Brûlure à un rang proche. | fx: dmg 18 feu @rank ; state 5 brulure dur 40 @rank |
| javelot_lumiere | Javelot de lumière | active | enemy | 5 | 0 | 12 | unité ×1 | —, attaque | 22 sacré, x2 contre les morts-vivants. | fx: dmg 22 sacre ×2 mort-vivant |
| nova_sacree | Nova sacrée | active | enemy | 5 | 0 | 18 | unité ×2 | —, attaque | 15 sacré aux ennemis des rangs 1-2. | fx: dmg 15 sacre @front ×2 mort-vivant |
| fleau | Fléau | active | enemy | 4 | 0 | 14 | unité ×1 | —, attaque | Poison 4 par tic (3 charges) et 8 maladie. | fx: state 4 poison dur 100 cap 3 ; dmg 8 maladie |
| toucher_spectral | Toucher spectral | active | enemy | 3 | 0 | 10 | unité ×1 | —, attaque | 18 ténèbres, rend la moitié en PV. | fx: drain 18 tenebres |
| lame_ombre | Lame d'ombre | active | enemy | 1 | 20 | 0 | arme ×1 | —, attaque, contact | 1,3x l'arme en ténèbres. | fx: wdmg 1300 tenebres |
| cri_effroi | Cri d'effroi | active | enemy | 5 | 20 | 0 | unité ×1 | — | −15 % de volonté aux ennemis des rangs 1-2. | fx: will -150 @front |
| mot_silence | Mot de silence | active | enemy | 5 | 0 | 12 | unité ×1 | — | Silence 80 : la cible ne peut plus lancer de sort à mana. | fx: state silence dur 80 |
| affaiblissement | Affaiblissement | active | enemy | 5 | 0 | 10 | unité ×1 | — | −25 % d’attaque pendant 80. | fx: state 250 affaibli dur 80 |
| jet_toile | Jet de toile | active | enemy | 4 | 15 | 0 | unité ×1 | — | Ralenti 80 et attire d’un rang. | fx: state ralenti dur 80 ; pull 1 |
| coup_jarret | Coup au jarret | active | enemy | 1 | 15 | 0 | arme ×1 | —, attaque, contact | 0,7x l’arme et Ralenti 60. | fx: wdmg 700 ; state ralenti dur 60 |
| tir_recul | Tir repoussant | active | enemy | 4 | 18 | 0 | arme ×1 | —, attaque | 0,8x l’arme et repousse d’un rang. | fx: wdmg 800 ; push 1 |
| coup_tonnerre | Coup de tonnerre | active | enemy | 1 | 25 | 0 | arme ×1.5 | —, attaque, contact | 1,2x l’arme et Étourdi 15. | fx: wdmg 1200 ; stun 15 |
| frappe_sismique | Frappe sismique | active | enemy | 1 | 30 | 0 | arme ×2 | —, attaque, contact | 0,9x l’arme à tout le rang au contact. | fx: wdmg 900 @rank |
| assassinat | Assassinat | active | enemy | 1 | 30 | 0 | arme ×1.5 | —, attaque, contact | 1,8x l’arme et Saignement. | fx: wdmg 1800 ; state 5 saignement dur 60 |
| coup_massue | Coup de massue | active | enemy | 1 | 22 | 0 | arme ×1.5 | —, attaque, contact | 1,4x l’arme et repousse d’un rang. | fx: wdmg 1400 ; push 1 |
| tir_perforant | Tir perforant | active | enemy | 5 | 20 | 0 | arme ×1.5 | —, attaque | 0,9x l’arme à tout le rang visé. | fx: wdmg 900 @rank |
| tir_empoisonne | Tir empoisonné | active | enemy | 4 | 15 | 0 | arme ×1 | —, attaque | 0,9x l’arme et Poison. | fx: state 3 poison dur 80 cap 3 ; wdmg 900 |
| fleche_feu | Flèche enflammée | active | enemy | 4 | 15 | 0 | arme ×1 | —, attaque | 1x l’arme en feu et Brûlure. | fx: wdmg 1000 feu ; state 4 brulure dur 40 |
| morsure_venin | Morsure venimeuse | active | enemy | 1 | 12 | 0 | arme ×1 | —, attaque, contact | 0,9x l’arme et Poison. | fx: state 3 poison dur 80 cap 3 ; wdmg 900 |
| soin_majeur | Soin majeur | active | ally | 3 | 0 | 16 | unité ×1 | — | +45 % des PV max. | fx: heal 450 |
| cercle_soins | Cercle de soins | active | self | 1 | 0 | 20 | unité ×2 | — | +18 % des PV max à tous les alliés. | fx: heal 180 @allies |
| seve | Sève régénératrice | active | ally | 2 | 0 | 12 | unité ×1 | — | Régénération +4 % par tic pendant 100. | fx: state 40 regeneration dur 100 |
| peau_ecorce | Peau d'écorce | active | ally | 2 | 0 | 10 | unité ×1 | — | +25 % de résistance à tout pendant 100. | fx: state 250 garde dur 100 |
| benediction | Bénédiction | active | self | 1 | 0 | 16 | unité ×2 | — | +15 % de résistance à tout aux alliés pendant 80. | fx: state 150 garde dur 80 @allies |
| chant_guerre | Chant de guerre | active | self | 1 | 0 | 12 | unité ×1.5 | — | +15 % d’attaque et +10 % de volonté aux alliés. | fx: state 150 cri dur 80 @allies ; will 100 @allies |
| vent_rapide | Vent rapide | active | self | 1 | 0 | 18 | unité ×1.5 | — | Hâte 60 aux alliés de son rang. | fx: state hate dur 60 @allyRank |
| carapace_epines | Carapace d'épines | active | self | 1 | 15 | 0 | unité ×1 | — | Renvoie 6 dégâts à chaque attaque au contact pendant 100. | fx: state 6 epines dur 100 |
| second_souffle | Second souffle | active | self | 1 | 0 | 0 | unité ×1.5 | — | +30 % d’énergie et +8 % de PV. | fx: energy 300 ; heal 80 |

## C. Troupes recrutables (40)

| id | Nom | Ville (niv. d’arrivée) | Unités | Pop. | Étiquettes | Rôle | Arme | Rang | Base | Croissance | Vitesse | Résistances | Capacités (niveau) | Emplacements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| milicien | Milicien | Havre-Gris (1) | 1 | 1 | humain | contact, protection | epee | 1 | 100/60/100/0/5 | 6/1/2/0/1 | 20 | tranch. +10 | Emploi d'arme 1, Exploit d'arme 1, Repos 3, Coup de bouclier 5, Repousser 8 | arme: une_main ; armure: legere/moyenne/lourde ; accessoire: bottes/anneau |
| chasseur | Chasseur | Havre-Gris (1) | 1 | 1 | humain | contrôle à distance | arc | 3 | 80/55/100/0/4 | 4/1/2/0/1 | 18 | glace +20 | Tir à l'arc 1, Repos 1, Marque du chasseur 4, Flèche de givre 8 | arme: arc ; armure: legere ; accessoire: bottes/anneau |
| acolyte | Acolyte | Havre-Gris (1) | 1 | 1 | humain | soin | masse | 3 | 70/80/80/40/2 | 4/2/1/2/0.5 | 22 | sacré +30, tén. -20 | Emploi d'arme 1, Soin mineur 1, Méditation 1, Trait sacré 4, Purification 7 | arme: une_main/baton ; armure: robe/legere ; accessoire: bottes/anneau |
| frondeurs | Frondeurs | Havre-Gris (1) | 3 | 2 | humain | tir depuis l’arrière | fronde | 3 | 55/45/80/0/3 | 3/1/2/0/1 | 18 | cont. -10 | Tir de fronde 1, Repos 1, Marque du chasseur 6 | arme: fronde ; armure: legere ; accessoire: bottes/anneau |
| moine | Novice du monastère | Havre-Gris (1) | 1 | 1 | humain | contact, contrôle | gantelets | 1 | 85/100/110/0/4 | 5/3/3/0/1 | 16 | psy. +30 | Emploi d'arme 1, Méditation 1, Repos 1, Repousser 5, Fracas 9 | arme: gantelets ; armure: robe/legere ; accessoire: bottes/anneau |
| ecuyer | Écuyer | Havre-Gris (1) | 1 | 1 | humain | contact, ralentit | epee | 1 | 95/55/100/0/5 | 6/1/2/0/1 | 19 | tranch. +10 | Emploi d'arme 1, Coup au jarret 3, Second souffle 6, Exploit d'arme 8, Coup de tonnerre 12 | arme: une_main ; armure: legere/moyenne/lourde ; accessoire: bottes/anneau |
| herboriste | Herboriste | Havre-Gris (1) | 1 | 1 | humain | soin, protection | masse | 3 | 70/75/80/40/2 | 4/2/1/2/0.5 | 22 | mal. +25 | Emploi d'arme 1, Sève régénératrice 1, Méditation 1, Peau d'écorce 4, Soin mineur 8, Cercle de soins 15 | arme: une_main/baton ; armure: robe/legere ; accessoire: bottes/anneau |
| braconniers | Braconniers | Havre-Gris (1) | 2 | 2 | humain | tir, poison | arc | 3 | 60/45/85/0/3 | 3/1/2/0/1 | 18 | glace +10 | Tir à l'arc 1, Repos 1, Tir empoisonné 3, Tir repoussant 8 | arme: arc ; armure: legere ; accessoire: bottes/anneau |
| pyromancien | Apprenti pyromancien | Port-Salant (6) | 1 | 2 | humain | dégâts de zone | baton | 3 | 65/55/70/50/2 | 3/1/1/3/1 | 24 | feu +40, glace -25 | Emploi d'arme 1, Trait de flammes 1, Boule de feu 5, Méditation 5 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| loups | Loups jumeaux | Port-Salant (6) | 2 | 2 | bete | harcèlement | crocs | 1 | 70/50/100/0/5 | 4/1/2/0/1 | 15 | glace +25, feu -25 | Morsure 1, Repos 1, Charge 5, Hurlement 9 | accessoire: collier |
| berserker | Berserker | Port-Salant (6) | 1 | 2 | humain | dégâts au contact | hache2m | 1 | 120/40/110/0/9 | 7/1/2/0/2 | 21 | psy. -20, mal. +10 | Emploi d'arme 1, Exploit d'arme 1, Rage 1, Lame saignante 4, Charge 8, Cri de guerre 12 | arme: deux_mains ; armure: legere/moyenne ; accessoire: bottes/collier/anneau |
| harponneur | Harponneur | Port-Salant (6) | 1 | 1 | humain | attire et achève | lance | 1 | 90/55/100/0/5 | 5/1/2/0/1 | 20 | glace +15 | Emploi d'arme 1, Repos 1, Grappin 3, Coup au jarret 6, Assassinat 14 | arme: deux_mains ; armure: legere ; accessoire: bottes/anneau |
| sorciere_marais | Sorcière des marais | Port-Salant (6) | 1 | 2 | humain | poison, affaiblissement | baton | 3 | 65/70/70/50/2 | 3/2/1/3/1 | 23 | mal. +40, feu -20 | Emploi d'arme 1, Fléau 1, Méditation 1, Affaiblissement 4, Toucher spectral 8, Nuage pestilentiel 14 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| gardes_maree | Gardes de la marée | Port-Salant (6) | 2 | 2 | humain | protection | epee | 1 | 85/60/100/0/4 | 5/1/2/0/1 | 20 | tranch. +15, cont. +10 | Emploi d'arme 1, Repos 1, Provocation 3, Carapace d'épines 6, Coup de bouclier 10 | arme: une_main ; armure: legere/moyenne/lourde ; accessoire: bottes/anneau |
| arbaletrier | Arbalétrier | Port-Salant (6) | 1 | 1 | humain | tir lourd | arbalete | 3 | 80/55/95/0/4 | 4/1/2/0/1 | 19 | — | Tir à l'arc 1, Repos 1, Tir perforant 5, Tir précis 10 | arme: arc ; armure: legere ; accessoire: bottes/anneau |
| chamane_crues | Chamane des crues | Port-Salant (6) | 1 | 2 | humain | glace, soin | baton | 3 | 70/70/75/50/2 | 4/2/1/3/1 | 22 | glace +30, feu -15 | Emploi d'arme 1, Éclat de glace 1, Méditation 1, Soin mineur 3, Tempête de givre 10 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| briseur | Briseur | Rochecreuse (11) | 1 | 3 | geant | tank lourd | masse_lourde | 1 | 180/70/120/0/8 | 10/1/2/0/2 | 28 | cont. +25, tranch. +25, feu -10 | Emploi d'arme 1, Exploit d'arme 1, Repos 1, Brise-armure 4, Fracas 8, Riposte 12 | arme: deux_mains ; armure: moyenne/lourde ; accessoire: collier/anneau |
| adepte | Adepte des ombres | Rochecreuse (11) | 1 | 2 | humain | affaiblissements | baton | 3 | 65/65/70/45/2 | 3/2/1/2/1 | 23 | tén. +30, sacré -30 | Emploi d'arme 1, Drain de vie 1, Méditation 1, Murmure de terreur 5, Malédiction de faiblesse 8 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| mineurs | Mineurs de fond | Rochecreuse (11) | 3 | 2 | nain | nuée au contact | pioche | 1 | 60/60/90/0/3 | 4/1/2/0/1 | 21 | cont. +15 | Emploi d'arme 1, Repos 1, Coup de massue 4, Frappe sismique 8 | arme: une_main ; armure: legere/moyenne/lourde ; accessoire: bottes/anneau |
| forgeron_runes | Forgeron des runes | Rochecreuse (11) | 1 | 2 | nain | renfort, étourdit | masse | 1 | 120/70/110/30/5 | 7/1/2/2/1 | 22 | feu +30, cont. +10 | Emploi d'arme 1, Chant de guerre 1, Coup de tonnerre 4, Repos 4, Bénédiction 10 | arme: une_main ; armure: legere/moyenne/lourde ; accessoire: bottes/anneau |
| eclaireuse | Éclaireuse des galeries | Rochecreuse (11) | 1 | 1 | humain | assassin | dague | 1 | 75/55/100/0/6 | 4/1/2/0/2 | 15 | tén. +15 | Emploi d'arme 1, Repos 1, Assassinat 4, Lame d'ombre 8, Hâte 12 | arme: une_main ; armure: legere ; accessoire: bottes/anneau |
| alchimiste | Alchimiste | Rochecreuse (11) | 1 | 1 | humain | feu et poison à distance | flasques | 3 | 65/60/80/35/3 | 3/1/1/2/1 | 20 | feu +20, mal. +20 | Tir de fronde 1, Méditation 1, Tir empoisonné 3, Flèche enflammée 6, Pluie de feu 12 | arme: fronde ; armure: robe/legere ; accessoire: bottes/anneau |
| gardien_pierre | Gardien de pierre | Rochecreuse (11) | 1 | 3 | construct | tank | masse_lourde | 1 | 190/80/120/0/7 | 11/1/2/0/2 | 28 | cont. +30, tranch. +30, glace -10 | Emploi d'arme 1, Repos 1, Provocation 3, Carapace d'épines 6, Frappe sismique 12, Riposte 16 | arme: deux_mains ; armure: lourde ; accessoire: collier/anneau |
| mage_cristal | Mage de cristal | Rochecreuse (11) | 1 | 2 | humain | glace, silence | baton | 3 | 65/70/70/55/2 | 3/2/1/3/1 | 23 | glace +35, cont. -15 | Emploi d'arme 1, Éclat de glace 1, Méditation 1, Mot de silence 5, Tempête de givre 10 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| lanciers_cendres | Lanciers des cendres | Cendrelune (16) | 2 | 2 | humain | contact, charge | lance | 1 | 80/55/100/0/5 | 5/1/2/0/1 | 20 | feu +25 | Emploi d'arme 1, Repos 1, Coup au jarret 3, Charge 6, Frappe sismique 12 | arme: deux_mains ; armure: legere/moyenne ; accessoire: bottes/anneau |
| nomade | Nomade des sables | Cendrelune (16) | 1 | 1 | humain | tir, contrôle | arc | 3 | 80/55/100/0/4 | 4/1/2/0/1 | 17 | feu +20 | Tir à l'arc 1, Repos 1, Flèche enflammée 3, Tir repoussant 6, Tir précis 12 | arme: arc ; armure: legere ; accessoire: bottes/anneau |
| derviche | Derviche | Cendrelune (16) | 1 | 2 | humain | tourbillon | griffes | 1 | 100/70/120/0/6 | 6/2/3/0/2 | 15 | psy. +20 | Emploi d'arme 1, Hâte 1, Second souffle 3, Tourbillon 6, Lame d'ombre 10 | arme: gantelets ; armure: legere/robe ; accessoire: bottes/anneau |
| pretresse_soleil | Prêtresse du soleil | Cendrelune (16) | 1 | 2 | humain | soin, sacré | sceptre | 3 | 75/85/80/55/2 | 4/2/1/3/1 | 21 | sacré +40, feu +20, tén. -20 | Emploi d'arme 1, Javelot de lumière 1, Méditation 1, Soin majeur 4, Bénédiction 10 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| scorpions | Scorpions dressés | Cendrelune (16) | 2 | 2 | bete | poison au contact | dard_s | 1 | 70/50/90/0/4 | 4/1/2/0/1 | 16 | feu +20, mal. +30 | Morsure 1, Repos 1, Morsure venimeuse 3, Carapace d'épines 6 | accessoire: collier |
| mage_cendre | Mage de cendre | Cendrelune (16) | 1 | 2 | humain | feu de zone | baton | 3 | 65/60/70/60/2 | 3/1/1/3/1 | 23 | feu +50, glace -25 | Emploi d'arme 1, Trait de flammes 1, Méditation 1, Pluie de feu 6, Éruption 15 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| garde_oasis | Garde de l'oasis | Cendrelune (16) | 1 | 2 | humain | protection | epee | 1 | 130/75/110/0/5 | 8/2/2/0/1 | 20 | tranch. +20, feu +20 | Emploi d'arme 1, Provocation 1, Repos 1, Mur de boucliers 5, Carapace d'épines 8, Coup de tonnerre 12 | arme: une_main ; armure: legere/moyenne/lourde ; accessoire: bottes/anneau |
| barde | Barde du désert | Cendrelune (16) | 1 | 1 | humain | renfort, peur | dague | 2 | 70/80/80/40/3 | 4/2/1/2/1 | 18 | psy. +30 | Emploi d'arme 1, Chant de guerre 1, Méditation 1, Cri d'effroi 4, Vent rapide 10 | arme: une_main ; armure: legere/robe ; accessoire: bottes/anneau |
| paladin | Paladin de l'aube | Sanctuaire de l'Aube (21) | 1 | 3 | humain | tank sacré | epee | 1 | 170/90/110/40/7 | 10/2/2/2/2 | 21 | sacré +40, tén. +20, tranch. +15 | Emploi d'arme 1, Provocation 1, Javelot de lumière 3, Bénédiction 8, Coup de tonnerre 12, Soin mineur 16 | arme: une_main ; armure: legere/moyenne/lourde ; accessoire: bottes/anneau |
| archonte_aube | Archonte | Sanctuaire de l'Aube (21) | 1 | 3 | celeste | soin de groupe, sacré | sceptre | 3 | 110/100/80/70/3 | 6/2/1/4/1 | 21 | sacré +50, psy. +30 | Emploi d'arme 1, Nova sacrée 1, Méditation 1, Cercle de soins 5, Mot de silence 10, Javelot de lumière 14 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| lames_jumelles | Lames jumelles | Sanctuaire de l'Aube (21) | 2 | 2 | humain | assassins | dague | 1 | 70/55/100/0/6 | 4/1/2/0/2 | 14 | tén. +15 | Emploi d'arme 1, Repos 1, Coup au jarret 1, Assassinat 3, Lame d'ombre 6 | arme: une_main ; armure: legere ; accessoire: bottes/anneau |
| tireur_astral | Tireur astral | Sanctuaire de l'Aube (21) | 1 | 2 | celeste | tir de précision | arc | 3 | 90/65/110/0/6 | 5/1/2/0/2 | 17 | glace +20, sacré +20 | Tir à l'arc 1, Repos 1, Marque du chasseur 1, Tir perforant 3, Tir précis 6 | arme: arc ; armure: legere ; accessoire: bottes/anneau |
| oracle | Oracle | Sanctuaire de l'Aube (21) | 1 | 2 | humain | affaiblissements | baton | 3 | 70/100/70/60/2 | 4/3/1/3/1 | 22 | psy. +40 | Emploi d'arme 1, Affaiblissement 1, Méditation 1, Mot de silence 3, Terreur de masse 10 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| chevalier_griffon | Chevalier-griffon | Sanctuaire de l'Aube (21) | 1 | 3 | humain | charge lourde | lance | 1 | 160/75/120/0/8 | 9/1/2/0/2 | 18 | tranch. +20, cont. +15 | Emploi d'arme 1, Repos 1, Charge 1, Coup de massue 4, Frappe sismique 10 | arme: deux_mains ; armure: moyenne/lourde ; accessoire: bottes/anneau |
| invocatrice | Invocatrice des tempêtes | Sanctuaire de l'Aube (21) | 1 | 2 | humain | glace et feu de zone | baton | 3 | 70/70/70/65/2 | 3/2/1/4/1 | 23 | glace +30, feu +30 | Emploi d'arme 1, Éclat de glace 1, Méditation 1, Tempête de givre 4, Éruption 12 | arme: baton ; armure: robe ; accessoire: bottes/anneau |
| gardiens_celestes | Gardiens célestes | Sanctuaire de l'Aube (21) | 3 | 3 | celeste | mur de boucliers | epee | 1 | 80/75/100/0/5 | 5/2/2/0/1 | 20 | sacré +30, tranch. +15 | Emploi d'arme 1, Repos 1, Provocation 3, Carapace d'épines 6 | arme: une_main ; armure: legere/moyenne/lourde ; accessoire: bottes/anneau |

Les 10 troupes reprises du banc d’essai (milicien, frondeurs, acolyte, pyromancien, chasseur, berserker, loups, adepte, moine, briseur) ont aussi des formes évoluées dans `content.ts`, mais **le prototype ville ne fait jamais évoluer une troupe** : elle reste dans sa forme de départ, et seules les capacités de cette forme s’apprennent. Formes définies (non jouables ici) :

- **Milicien** : Fantassin (niv. 10, depuis Milicien, PV ×1.15, vitesse 19, Provocation 10, Riposte 14) ; Garde du rempart (niv. 20, depuis Fantassin, PV ×1.3, vitesse 20, Dernier rempart 20, Mur de boucliers 24) ; Lame vétérane (niv. 20, depuis Fantassin, PV ×1.15, vitesse 17, Exécution 20, Brise-armure 22, Charge 26)
- **Frondeurs** : Tirailleur (niv. 10, depuis Frondeur, PV ×1.2, vitesse 16, Volée 10, Tir précis 16)
- **Acolyte** : Prêtre (niv. 10, depuis Acolyte, PV ×1.1, vitesse 21, Régénération 10, Bouclier de foi 13) ; Haut-prêtre (niv. 20, depuis Prêtre, PV ×1.15, vitesse 20, Prière collective 20, Aura de sérénité 24) ; Inquisiteur (niv. 20, depuis Prêtre, PV ×1.25, vitesse 20, Trait sacré renforcé 20, Confusion 24)
- **Apprenti pyromancien** : Pyromancien (niv. 10, depuis Apprenti pyromancien, PV ×1.1, vitesse 22, Arme enflammée 10, Mur de flammes 15) ; Maître des cendres (niv. 20, depuis Pyromancien, PV ×1.15, vitesse 21, Embrasement 20, Cœur ardent 25)
- **Chasseur** : Traqueur des neiges (niv. 10, depuis Chasseur, PV ×1.15, vitesse 16, Grappin 10, Pièges de glace 16, Tir précis 22)
- **Berserker** : Massacreur (niv. 15, depuis Berserker, PV ×1.2, vitesse 19, Exécution 15, Tourbillon 20)
- **Loups jumeaux** : Loup alpha (niv. 12, depuis Loup, PV ×1.2, vitesse 13, Instinct de meute 12, Exécution 18)
- **Adepte des ombres** : Nécromancien (niv. 10, depuis Adepte des ombres, PV ×1.1, vitesse 22, Nuage pestilentiel 10, Lien vital 15) ; Liche (niv. 20, depuis Nécromancien, PV ×1.1, vitesse 22, Non-mort 20, Terreur de masse 24) ; Sorcier de peste (niv. 20, depuis Nécromancien, PV ×1.2, vitesse 21, Contagion 20, Nuage renforcé 24)
- **Novice du monastère** : Moine (niv. 10, depuis Novice, PV ×1.15, vitesse 15, Confusion (moine) 10, Hâte 15) ; Maître du souffle (niv. 20, depuis Moine, PV ×1.2, vitesse 14, Esprit inébranlable 20, Paume du vide 24)
- **Briseur** : Colosse de siège (niv. 15, depuis Briseur, PV ×1.25, vitesse 27, Repousser renforcé 15, Provocation 18, Séisme 24)

## D. Monstres (77, dont 5 gardiens et 20 rares)

Les monstres connaissent toutes les capacités de leur forme au niveau où ils sont générés (les 7 de la Forêt des Ronces ont des niveaux d’apprentissage ; les 50 du bestiaire les ont toutes au niveau 1). Les rares sont dérivés d’un modèle (voir README 7.4).

| id | Nom | Région | Unités | Pop. | Étiquettes | Rôle | Arme | Rang | Base | Croissance | Vitesse | Résistances | Capacités | Butin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gobelins | Gobelins pillards | 1 | 3 | 3 | gobelin | nuée au contact | coutelas | 1 | 38/40/70/0/2 | 3/1/1/0/1 | 17 | tén. +10, sacré -10 | Emploi d'arme, Repos, Lame saignante 4, Exploit d'arme 7 | Oreille de gobelin, Ferraille rouillée, Cuir brut |
| frondeurs_gob | Gobelins frondeurs | 1 | 2 | 2 | gobelin | tir | fronde_gob | 3 | 32/35/70/0/2 | 2/1/1/0/1 | 18 | sacré -10 | Tir de fronde, Repos, Marque du chasseur 6 | Oreille de gobelin, Pierre lisse, Cuir brut |
| loup_gris | Loup gris | 1 | 1 | 1 | bete | harcèlement | crocs_gris | 1 | 60/45/90/0/4 | 4/1/2/0/1 | 15 | glace +20, feu -20 | Morsure, Repos, Charge 4, Hurlement 8 | Croc de loup, Cuir brut, Cuir épais |
| araignee | Araignée des ronces | 1 | 1 | 2 | bete | poison | chelicères | 2 | 75/50/80/30/3 | 4/1/1/2/1 | 18 | mal. +40, feu -25 | Emploi d'arme, Repos, Nuage pestilentiel 3, Grappin 6 | Fil d'araignée, Glande à venin, Champignon pâle |
| chaman | Chaman gobelin | 1 | 1 | 2 | gobelin | soin, malédictions | baton_os | 3 | 55/60/70/45/2 | 3/2/1/3/1 | 22 | tén. +25, sacré -25 | Emploi d'arme, Trait de flammes, Soin mineur 3, Murmure de terreur 6, Malédiction de faiblesse 9 | Plume de corbeau, Champignon pâle, Oreille de gobelin, Totem gobelin |
| troll | Troll des fourrés | 1 | 1 | 3 | geant | brute | gourdin | 1 | 150/55/110/0/6 | 9/1/2/0/2 | 26 | cont. +20, feu -20 | Emploi d'arme, Repos, Exploit d'arme 3, Riposte 6 | Os ancien, Cuir épais, Pierre lisse |
| sylvain | Sylvain des Ronces **(gardien)** | 1 | 1 | 4 | plante | gardien | branches | 1 | 300/90/130/30/9 | 12/2/2/2/2 | 25 | tranch. +25, cont. +15, mal. +30, feu -30 | Emploi d'arme, Repos, Repousser, Brise-armure, Régénération, Riposte | Sève ambrée, Bois tordu, Résine collante, Cœur de ronce |
| loup_alpha | Loup alpha | 1 | 1 | 2 | bete | chef de meute | crocs_gris | 1 | 90/60/100/0/6 | 5/1/2/1/1 | 14 | glace +25, feu -20 | Morsure, Repos, Charge, Hurlement | Croc de loup, Cuir épais, Cuir brut |
| corbeaux | Nuée de corbeaux | 1 | 3 | 2 | bete | harcèlement | bec | 1 | 30/35/70/0/2 | 3/1/1/0/1 | 13 | cont. -20 | Morsure, Repos | Plume de corbeau, Champignon pâle |
| noyes | Noyés | 2 | 3 | 3 | mort-vivant | nuée au contact | lame_rouillee | 1 | 50/90/70/0/3 | 3/1/1/0/1 | 21 | mal. +50, sacré -40, glace +20 | Emploi d'arme, Repos, Lame saignante | Algue noire, Os ancien, Perle noyée |
| crapaud | Crapaud géant | 2 | 1 | 2 | bete | poison | dard | 1 | 110/50/90/0/4 | 5/1/2/1/1 | 20 | mal. +40 | Morsure, Repos, Morsure venimeuse, Jet de toile | Glande à venin, Écaille terne |
| sangsues | Sangsues géantes | 2 | 3 | 2 | bete | drain | dard | 1 | 40/40/70/30/2 | 3/1/1/0/1 | 17 | mal. +30, feu -30 | Morsure, Toucher spectral | Algue noire, Glande à venin |
| feu_follet | Feu follet | 2 | 1 | 1 | esprit | feu à distance | mains_spectrales | 3 | 45/70/60/50/3 | 3/2/1/3/1 | 18 | feu +60, glace -30, tranch. +30 | Emploi d'arme, Trait de flammes, Méditation | Tourbe compacte, Plume de héron |
| hommes_lezards | Hommes-lézards | 2 | 2 | 2 | reptile | contact, ralentit | harpon_m | 1 | 80/55/90/0/4 | 5/1/2/1/1 | 19 | glace -20, mal. +20 | Emploi d'arme, Repos, Coup au jarret, Grappin | Écaille terne, Cuir épais |
| sorciere_noyee | Sorcière noyée | 2 | 1 | 2 | mort-vivant | malédictions | baton_m | 3 | 70/80/70/55/2 | 3/2/1/3/1 | 23 | mal. +40, sacré -40 | Emploi d'arme, Fléau, Affaiblissement, Méditation | Algue noire, Perle noyée, Sève ambrée |
| crocodile | Crocodile des fanges | 2 | 1 | 3 | reptile, bete | brute | machoires | 1 | 170/55/110/0/7 | 8/1/2/1/2 | 24 | tranch. +20, glace -20 | Morsure, Repos, Assassinat | Écaille terne, Cuir épais, Os ancien |
| moustiques | Essaim de moustiques | 2 | 3 | 1 | bete | nuée | dard | 1 | 22/30/60/0/1 | 3/1/1/0/1 | 12 | feu -40 | Morsure, Morsure venimeuse | Glande à venin, Tourbe compacte |
| troll_marais | Troll des marais | 2 | 1 | 3 | geant | brute qui se soigne | gourdin | 1 | 180/55/110/30/6 | 8/1/2/1/2 | 26 | cont. +20, feu -30 | Emploi d'arme, Repos, Coup de massue, Sève régénératrice | Os ancien, Tourbe compacte, Cuir épais |
| spectre_brumes | Spectre des brumes | 2 | 1 | 2 | mort-vivant, esprit | drain, peur | mains_spectrales | 2 | 70/90/80/45/3 | 3/2/1/3/1 | 18 | tranch. +40, cont. +40, sacré -50 | Emploi d'arme, Toucher spectral, Cri d'effroi | Plume de héron, Perle noyée |
| pecheurs_maudits | Pêcheurs maudits | 2 | 2 | 2 | mort-vivant | attirent | harpon_m | 2 | 65/80/80/0/4 | 5/1/2/1/1 | 20 | mal. +40, sacré -40 | Emploi d'arme, Repos, Grappin | Algue noire, Fer noir |
| mere_noyes | Mère des Noyés **(gardien)** | 2 | 1 | 5 | mort-vivant | gardienne | mains_spectrales | 2 | 320/100/120/80/9 | 13/2/2/2/2 | 22 | mal. +50, glace +30, sacré -40 | Emploi d'arme, Fléau, Tempête de givre, Toucher spectral, Cercle de soins | Perle noyée, Algue noire, Cœur du marais |
| kobolds | Kobolds | 3 | 3 | 2 | kobold | nuée | lame_rouillee | 1 | 42/40/80/0/3 | 3/1/1/0/1 | 16 | feu +10 | Emploi d'arme, Repos, Lame saignante | Minerai d'argent, Charbon dense |
| artificier | Kobold artificier | 3 | 1 | 1 | kobold | explosifs | flasques | 3 | 50/45/70/30/3 | 3/1/1/0/1 | 19 | feu +30 | Tir de fronde, Flèche enflammée, Repos | Soufre, Charbon dense |
| golem_pierre | Golem de pierre | 3 | 1 | 3 | construct | tank | poing_pierre | 1 | 200/99/110/0/6 | 8/1/2/1/2 | 28 | cont. +35, tranch. +35, mal. +50, glace -20 | Emploi d'arme, Repos, Coup de massue, Carapace d'épines | Cristal brut, Noyau de golem |
| chauves_souris | Chauves-souris des puits | 3 | 3 | 1 | bete | harcèlement | bec | 1 | 28/40/60/0/2 | 3/1/1/0/1 | 12 | sacré -20 | Morsure, Repos | Cuir de basilic, Charbon dense |
| ver_galeries | Ver des galeries | 3 | 1 | 2 | bete | poison, secousses | machoires | 1 | 130/50/100/0/5 | 5/1/2/1/1 | 23 | cont. +20 | Morsure, Morsure venimeuse, Frappe sismique | Soie des profondeurs, Cuir de basilic |
| nains_renegats | Nains renégats | 3 | 2 | 2 | nain | contact, étourdit | pioche | 1 | 90/65/100/0/5 | 5/1/2/1/1 | 21 | cont. +15, feu +15 | Emploi d'arme, Repos, Coup de tonnerre | Minerai d'argent, Fer noir |
| elementaire_cristal | Élémentaire de cristal | 3 | 1 | 2 | construct | glace | mains_spectrales | 3 | 80/99/70/60/3 | 3/2/1/3/1 | 22 | glace +60, cont. -30 | Emploi d'arme, Éclat de glace, Tempête de givre, Méditation | Cristal brut, Gemme profonde |
| basilic | Basilic | 3 | 1 | 3 | reptile | regard affaiblissant | machoires | 1 | 160/70/100/40/6 | 8/1/2/1/2 | 23 | tranch. +20, mal. +20 | Morsure, Affaiblissement, Morsure venimeuse | Cuir de basilic, Soie des profondeurs |
| gelee | Gelée acide | 3 | 1 | 1 | vase | poison | dard | 1 | 80/99/60/0/3 | 3/1/1/0/1 | 22 | tranch. +30, cont. +30, feu -30 | Morsure, Morsure venimeuse | Soufre, Soie des profondeurs |
| contremaitre | Contremaître kobold | 3 | 1 | 2 | kobold | chef | lame_rouillee | 2 | 90/70/90/30/4 | 5/1/2/1/1 | 20 | feu +10 | Emploi d'arme, Chant de guerre, Repos | Minerai d'argent, Charbon dense |
| mineurs_fantomes | Mineurs fantômes | 3 | 2 | 2 | mort-vivant | drain | pioche | 1 | 70/80/80/30/4 | 5/1/2/1/1 | 21 | tranch. +30, sacré -40 | Emploi d'arme, Toucher spectral | Minerai d'argent, Cristal brut |
| coeur_forge | Cœur-de-Forge **(gardien)** | 3 | 1 | 5 | construct | gardien | poing_pierre | 1 | 420/99/140/60/10 | 13/2/2/2/2 | 27 | cont. +35, tranch. +35, feu +50, glace -20 | Emploi d'arme, Coup de tonnerre, Frappe sismique, Carapace d'épines, Éruption | Noyau de golem, Gemme profonde, Cristal brut |
| scorpions_geants | Scorpions géants | 4 | 2 | 2 | bete | poison | dard | 1 | 85/55/90/0/5 | 5/1/2/1/1 | 16 | feu +30, mal. +30 | Morsure, Morsure venimeuse, Repos | Chitine dorée, Sel ardent |
| momies | Momies | 4 | 2 | 2 | mort-vivant | maladie | lame_rouillee | 1 | 95/99/80/30/4 | 5/1/2/1/1 | 23 | mal. +50, feu -40, sacré -30 | Emploi d'arme, Fléau | Os de dragonnet, Essence de mirage |
| djinn | Djinn mineur | 4 | 1 | 2 | esprit | feu de zone | souffle | 3 | 85/80/70/70/4 | 3/2/1/3/1 | 20 | feu +70, glace -30 | Emploi d'arme, Trait de flammes, Pluie de feu, Méditation | Essence de mirage, Flamme figée |
| pillards_sable | Pillards des sables | 4 | 3 | 3 | humain | assassins | lame_rouillee | 1 | 65/50/90/0/5 | 5/1/2/1/1 | 17 | feu +20 | Emploi d'arme, Repos, Assassinat | Sel ardent, Écorce de cendre |
| archers_nomades | Archers nomades | 4 | 2 | 2 | humain | tir enflammé | arc_m | 3 | 70/55/90/0/5 | 5/1/2/1/1 | 17 | feu +20 | Tir à l'arc, Repos, Flèche enflammée | Écorce de cendre, Verre de cendre |
| salamandre | Salamandre | 4 | 1 | 2 | reptile | souffle | souffle | 2 | 110/60/110/0/5 | 5/1/2/1/1 | 19 | feu +80, glace -40 | Emploi d'arme, Souffle de feu, Repos | Os de dragonnet, Sel ardent |
| ver_sables | Ver des sables | 4 | 1 | 3 | bete | secousses | machoires | 1 | 200/50/120/0/7 | 8/1/2/1/2 | 25 | cont. +25 | Morsure, Frappe sismique, Repos | Chitine dorée, Os de dragonnet |
| vautours | Vautours | 4 | 3 | 1 | bete | harcèlement | bec | 1 | 35/40/70/0/3 | 3/1/1/0/1 | 13 | — | Morsure, Repos | Écorce de cendre, Sel ardent |
| ombre_mirage | Ombre du mirage | 4 | 1 | 1 | esprit | silence | mains_spectrales | 2 | 60/80/80/40/5 | 3/2/1/3/1 | 15 | tranch. +40, cont. +40, sacré -40 | Emploi d'arme, Lame d'ombre, Mot de silence | Essence de mirage, Verre de cendre |
| golem_verre | Golem de verre | 4 | 1 | 3 | construct | épines | poing_pierre | 1 | 190/99/110/0/6 | 8/1/2/1/2 | 27 | tranch. +40, feu +40, cont. -30 | Emploi d'arme, Coup de massue, Carapace d'épines | Verre de cendre, Flamme figée |
| pretre_scarabee | Prêtre-scarabée | 4 | 1 | 2 | humain | soin, affaiblit | baton_m | 3 | 80/80/70/60/3 | 3/2/1/3/1 | 22 | feu +30, sacré +20 | Emploi d'arme, Soin mineur, Affaiblissement, Méditation | Chitine dorée, Essence de mirage |
| dragon_cendre | Dragon de cendre **(gardien)** | 4 | 1 | 6 | dragon | gardien | souffle | 1 | 600/99/150/80/13 | 13/2/2/2/2 | 24 | feu +75, tranch. +25, glace -30 | Emploi d'arme, Souffle de feu, Éruption, Coup de massue, Cri d'effroi | Cœur de dragon, Os de dragonnet, Flamme figée |
| sentinelles | Sentinelles de marbre | 5 | 2 | 2 | construct | protection | lame_lumiere | 1 | 110/99/100/0/5 | 5/1/2/1/1 | 22 | tranch. +30, cont. +20, sacré +40 | Emploi d'arme, Provocation, Repos | Pierre de lune, Éclat astral |
| gargouilles | Gargouilles | 5 | 2 | 2 | construct | épines, coups lourds | poing_pierre | 1 | 110/99/100/0/6 | 5/1/2/1/1 | 23 | cont. +30, tranch. +30 | Emploi d'arme, Coup de massue, Carapace d'épines | Pierre de lune, Poussière d'étoile |
| anges_dechus | Ange déchu | 5 | 1 | 2 | celeste | ombre et drain | lame_lumiere | 2 | 100/80/90/50/6 | 5/1/2/1/1 | 18 | tén. +40, sacré +40 | Emploi d'arme, Lame d'ombre, Toucher spectral | Plume séraphique, Larme d'aube |
| harpies | Harpies célestes | 5 | 3 | 2 | bete | peur | griffes_m | 1 | 55/50/90/0/4 | 3/1/1/0/1 | 13 | glace +20 | Morsure, Cri d'effroi, Repos | Plume séraphique, Fil de lumière |
| astromancien | Astromancien | 5 | 1 | 2 | humain | glace, silence | baton_m | 3 | 80/90/70/70/3 | 3/2/1/3/1 | 22 | glace +40, psy. +30 | Emploi d'arme, Tempête de givre, Mot de silence, Méditation | Éclat astral, Poussière d'étoile |
| golem_astral | Golem astral | 5 | 1 | 3 | construct | tank | poing_pierre | 1 | 230/99/120/0/7 | 8/1/2/1/2 | 27 | cont. +35, tranch. +35, sacré +30 | Emploi d'arme, Coup de tonnerre, Carapace d'épines | Éclat astral, Pierre de lune, Plume d'archonte |
| griffons | Griffon sauvage | 5 | 1 | 2 | bete | charge | griffes_m | 1 | 120/60/110/0/6 | 5/1/2/1/1 | 15 | tranch. +15 | Morsure, Charge, Repos | Plume séraphique, Fil de lumière |
| spectres_lumiere | Spectres de lumière | 5 | 2 | 2 | esprit | sacré de zone | lame_lumiere | 3 | 65/90/70/50/4 | 3/2/1/3/1 | 20 | sacré +60, tén. -40, tranch. +30 | Emploi d'arme, Nova sacrée, Javelot de lumière | Larme d'aube, Fil de lumière |
| chimere | Chimère | 5 | 1 | 3 | bete | feu et poison | machoires | 1 | 190/70/120/0/7 | 8/1/2/1/2 | 20 | feu +40, mal. +30 | Morsure, Souffle de feu, Morsure venimeuse | Poussière d'étoile, Os de dragonnet |
| archers_celestes | Archers célestes | 5 | 2 | 2 | celeste | tir perforant | arc_m | 3 | 75/70/100/0/6 | 5/1/2/1/1 | 17 | sacré +30 | Tir à l'arc, Tir perforant, Repos | Fil de lumière, Éclat astral |
| gardien_seuil | Gardien du seuil | 5 | 1 | 3 | celeste | protection, étourdit | lame_lumiere | 1 | 210/99/120/30/7 | 8/1/2/1/2 | 22 | sacré +50, tranch. +25, cont. +25 | Emploi d'arme, Provocation, Coup de tonnerre, Bénédiction | Larme d'aube, Plume d'archonte |
| archonte_dechu | Archonte déchu **(gardien)** | 5 | 1 | 6 | celeste | gardien | lame_lumiere | 2 | 480/99/150/100/11 | 13/2/2/2/2 | 21 | sacré +50, tén. +50, psy. +40 | Emploi d'arme, Nova sacrée, Éruption, Cercle de soins, Mot de silence, Lame d'ombre | Couronne de l'aube, Plume d'archonte, Larme d'aube |
| rare_lisiere | Croc-de-Givre *(rare)* | 1 | 1 | 2 | bete | monstre rare (harcèlement) | crocs_gris | 1 | 144/59/90/0/7 | 9.6/1/2/0/1 | 15 | glace +20, feu -20 | Morsure, Repos, Charge 4, Hurlement 8 | Fourrure de Croc-de-Givre |
| rare_sentier | Grishnak le Balafré *(rare)* | 1 | 1 | 2 | gobelin | monstre rare (nuée au contact) | coutelas | 1 | 274/52/70/0/5 | 21.6/1/1/0/1 | 17 | tén. +10, sacré -10 | Emploi d'arme, Repos, Lame saignante 4, Exploit d'arme 7 | Bannière de Grishnak |
| rare_nids | Reine-Soie *(rare)* | 1 | 1 | 2 | bete | monstre rare (poison) | chelicères | 2 | 180/65/80/30/6 | 9.6/1/1/2/1 | 18 | mal. +40, feu -25 | Emploi d'arme, Repos, Nuage pestilentiel 3, Grappin 6 | Œuf de Reine-Soie |
| rare_camp | Vieux Mâchefer *(rare)* | 1 | 1 | 2 | geant | monstre rare (brute) | gourdin | 1 | 360/72/110/0/9 | 21.6/1/2/0/2 | 26 | cont. +20, feu -20 | Emploi d'arme, Repos, Exploit d'arme 3, Riposte 6 | Œil de Mâchefer |
| rare_berges | Gueule-de-Vase *(rare)* | 2 | 1 | 2 | bete | monstre rare (poison) | dard | 1 | 264/65/90/0/7 | 12/1/2/1/1 | 20 | mal. +40 | Morsure, Repos, Morsure venimeuse, Jet de toile | Langue de Gueule-de-Vase |
| rare_roselieres | Ssark l’Écorcheur *(rare)* | 2 | 1 | 2 | reptile | monstre rare (contact, ralentit) | harpon_m | 1 | 384/72/90/0/7 | 24/1/2/1/1 | 19 | glace -20, mal. +20 | Emploi d'arme, Repos, Coup au jarret, Grappin | Crâne peint de Ssark |
| rare_epaves | Capitaine sans visage *(rare)* | 2 | 1 | 2 | mort-vivant | monstre rare (attirent) | harpon_m | 2 | 250/104/80/0/7 | 19.2/1/2/1/1 | 20 | mal. +40, sacré -40 | Emploi d'arme, Repos, Grappin | Lanterne du Capitaine |
| rare_tertre | Mangeur-de-Barques *(rare)* | 2 | 1 | 2 | reptile, bete | monstre rare (brute) | machoires | 1 | 326/72/110/0/10 | 15.4/1/2/1/2 | 24 | tranch. +20, glace -20 | Morsure, Repos, Assassinat | Dent du Mangeur-de-Barques |
| rare_entree | Brûle-Mèche *(rare)* | 3 | 1 | 2 | kobold | monstre rare (explosifs) | flasques | 3 | 120/59/70/30/6 | 7.2/1/1/0/1 | 19 | feu +30 | Tir de fronde, Flèche enflammée, Repos | Détonateur de Brûle-Mèche |
| rare_galeries | Grand Ver blanc *(rare)* | 3 | 1 | 2 | bete | monstre rare (poison, secousses) | machoires | 1 | 312/65/100/0/8 | 12/1/2/1/1 | 23 | cont. +20 | Morsure, Morsure venimeuse, Frappe sismique | Mandibule du Grand Ver |
| rare_filons | Prisme vivant *(rare)* | 3 | 1 | 2 | construct | monstre rare (glace) | mains_spectrales | 3 | 173/129/70/60/6 | 6.5/2/1/3/1 | 22 | glace +60, cont. -30 | Emploi d'arme, Éclat de glace, Tempête de givre, Méditation | Cœur de prisme |
| rare_puits | Basilic à l’œil d’or *(rare)* | 3 | 1 | 2 | reptile | monstre rare (regard affaiblissant) | machoires | 1 | 307/91/100/40/9 | 15.4/1/2/1/2 | 23 | tranch. +20, mal. +20 | Morsure, Affaiblissement, Morsure venimeuse | Œil d’or |
| rare_dunes | Mirage jumeau *(rare)* | 4 | 1 | 2 | esprit | monstre rare (silence) | mains_spectrales | 2 | 173/104/80/40/9 | 8.6/2/1/3/1 | 15 | tranch. +40, cont. +40, sacré -40 | Emploi d'arme, Lame d'ombre, Mot de silence | Voile du Mirage jumeau |
| rare_caravane | Khaled Main-Rouge *(rare)* | 4 | 1 | 2 | humain | monstre rare (assassins) | lame_rouillee | 1 | 468/65/90/0/8 | 36/1/2/1/1 | 17 | feu +20 | Emploi d'arme, Repos, Assassinat | Sceau de Main-Rouge |
| rare_tombeaux | Grand prêtre Ankhaset *(rare)* | 4 | 1 | 2 | humain | monstre rare (soin, affaiblit) | baton_m | 3 | 288/104/70/60/8 | 10.8/2/1/3/1 | 22 | feu +30, sacré +20 | Emploi d'arme, Soin mineur, Affaiblissement, Méditation | Scarabée d’or d’Ankhaset |
| rare_verrerie | Ver-Roi des sables *(rare)* | 4 | 1 | 2 | bete | monstre rare (secousses) | machoires | 1 | 480/65/120/0/10 | 19.2/1/2/1/2 | 25 | cont. +25 | Morsure, Frappe sismique, Repos | Perle du Ver-Roi |
| rare_marches | Griffon aux ailes d’argent *(rare)* | 5 | 1 | 2 | bete | monstre rare (charge) | griffes_m | 1 | 288/78/110/0/9 | 12/1/2/1/1 | 15 | tranch. +15 | Morsure, Charge, Repos | Rémige d’argent |
| rare_parvis | Sentinelle éveillée *(rare)* | 5 | 1 | 2 | construct | monstre rare (protection) | lame_lumiere | 1 | 370/129/100/0/8 | 16.8/1/2/1/1 | 22 | tranch. +30, cont. +20, sacré +40 | Emploi d'arme, Provocation, Repos | Glyphe de vigilance |
| rare_observatoire | Astromancien fou *(rare)* | 5 | 1 | 2 | humain | monstre rare (glace, silence) | baton_m | 3 | 192/117/70/70/6 | 7.2/2/1/3/1 | 22 | glace +40, psy. +30 | Emploi d'arme, Tempête de givre, Mot de silence, Méditation | Astrolabe brisé |
| rare_jardins | Chimère à trois têtes *(rare)* | 5 | 1 | 2 | bete | monstre rare (feu et poison) | machoires | 1 | 319/91/120/0/10 | 13.4/1/2/1/2 | 20 | feu +40, mal. +30 | Morsure, Souffle de feu, Morsure venimeuse | Corne de chimère |

## E. Stratégies par défaut (règles si/alors, dans l’ordre)

Les 10 troupes du banc d’essai et les 7 monstres d’origine ont des règles écrites à la main ; les autres sont générées par `ia.ts` (README 5.6). Une règle dont la capacité n’est pas encore apprise est retirée pour une troupe de joueur (`defaultRules`). Liste au niveau 30 (toutes capacités connues).

- **Milicien** (`milicien`, attaque de base : Emploi d'arme) : én.< 15% → Repos · PV allié< 60% → Mur de boucliers · n'a pas Provocation → Provocation · toujours → Exécution (plus faible) · cible n'a pas Étourdi → Coup de bouclier (plus proche) · én.≥ 80% → Repousser (plus proche) · én.≥ 50% → Exploit d'arme (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer
- **Chasseur** (`chasseur`, attaque de base : Tir à l'arc) : én.< 15% → Repos · cible n'a pas Gelé → Flèche de givre (plus proche) · cible n'a pas Marque → Marque du chasseur (plus fort) · én.≥ 80% → Grappin (plus fort) · toujours → Tir précis (plus fort) · toujours → Tir à l'arc (plus faible) · aucun ennemi à portée → Avancer
- **Acolyte** (`acolyte`, attaque de base : Emploi d'arme) : PV allié< 40% → Prière collective · PV allié< 50% → Soin mineur (allié le plus blessé) · cible a Poison → Purification (allié le plus blessé) · PV allié< 70% → Bouclier de foi (allié le plus blessé) · PV allié< 85% → Régénération (allié le plus blessé) · vol.< 50% → Méditation · cible n'a pas Confusion → Confusion (plus fort) · toujours → Trait sacré renforcé (plus proche) · toujours → Trait sacré (plus proche) · toujours → Emploi d'arme (plus proche) · toujours → Attendre
- **Frondeurs** (`frondeurs`, attaque de base : Tir de fronde) : én.< 15% → Repos · cible n'a pas Marque → Marque du chasseur (plus fort) · ennemis≥ 3 → Volée (plus proche) · toujours → Tir de fronde (plus faible) · aucun ennemi à portée → Avancer
- **Novice du monastère** (`moine`, attaque de base : Emploi d'arme) : én.< 15% → Repos · vol.< 50% → Méditation · n'a pas Hâte → Hâte · cible a Gelé → Fracas (plus proche) · cible n'a pas Confusion → Paume du vide (plus proche) · cible n'a pas Confusion → Confusion (moine) (plus fort) · én.≥ 80% → Repousser (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer
- **Écuyer** (`ecuyer`, attaque de base : Emploi d'arme) : én.< 20% → Second souffle · cible n'a pas Ralenti → Coup au jarret (plus proche) · én.≥ 60% → Coup de tonnerre (plus proche) · én.≥ 40% → Exploit d'arme (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Herboriste** (`herboriste`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · PV allié< 50% → Cercle de soins · PV allié< 55% → Soin mineur (allié le plus blessé) · cible n'a pas Régénération → Sève régénératrice (allié le plus blessé) · cible n'a pas Garde → Peau d'écorce (allié le plus blessé) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Braconniers** (`braconniers`, attaque de base : Tir à l'arc) : én.< 15% → Repos · cible n'a pas Poison → Tir empoisonné (plus fort) · én.≥ 60% → Tir repoussant (plus proche) · toujours → Tir à l'arc (plus faible) · toujours → Attendre
- **Apprenti pyromancien** (`pyromancien`, attaque de base : Emploi d'arme) : vol.< 40% → Méditation · cible a Brûlure → Embrasement (plus proche) · cible n'a pas Arme enflammée → Arme enflammée (allié le plus blessé) · ennemis≥ 3 → Mur de flammes (plus proche) · cible n'a pas Brûlure → Boule de feu (plus proche) · toujours → Trait de flammes (plus faible) · toujours → Emploi d'arme (plus proche) · toujours → Attendre
- **Loups jumeaux** (`loups`, attaque de base : Morsure) : én.< 10% → Repos · vol.< 60% → Hurlement · toujours → Charge (plus faible) · toujours → Exécution (plus faible) · toujours → Morsure (plus faible) · aucun ennemi à portée → Avancer
- **Berserker** (`berserker`, attaque de base : Emploi d'arme) : n'a pas Cri de guerre → Cri de guerre · toujours → Charge (plus proche) · toujours → Exécution (plus faible) · ennemis≥ 2 → Tourbillon · cible n'a pas Saignement → Lame saignante (plus proche) · én.≥ 40% → Exploit d'arme (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer
- **Harponneur** (`harponneur`, attaque de base : Emploi d'arme) : én.< 15% → Repos · toujours → Assassinat (plus faible) · én.≥ 60% → Grappin (plus proche) · cible n'a pas Ralenti → Coup au jarret (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Sorcière des marais** (`sorciere_marais`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · cible n'a pas Poison → Fléau (plus fort) · cible n'a pas Affaibli → Affaiblissement (plus fort) · cible n'a pas Poison → Nuage pestilentiel (plus fort) · toujours → Toucher spectral (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Gardes de la marée** (`gardes_maree`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Provocation → Provocation · n'a pas Épines → Carapace d'épines · cible n'a pas Étourdi → Coup de bouclier (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Arbalétrier** (`arbaletrier`, attaque de base : Tir à l'arc) : én.< 15% → Repos · ennemis≥ 3 → Tir perforant (plus proche) · én.≥ 40% → Tir précis (plus faible) · toujours → Tir à l'arc (plus faible) · toujours → Attendre
- **Chamane des crues** (`chamane_crues`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · PV allié< 55% → Soin mineur (allié le plus blessé) · ennemis≥ 3 → Tempête de givre (plus proche) · toujours → Éclat de glace (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Briseur** (`briseur`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Provocation → Provocation · ennemis≥ 3 → Séisme · én.≥ 70% → Repousser renforcé · cible a Gelé → Fracas (plus proche) · cible n'a pas Brise-armure → Brise-armure (plus fort) · én.≥ 50% → Exploit d'arme (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer
- **Adepte des ombres** (`adepte`, attaque de base : Emploi d'arme) : vol.< 40% → Méditation · ennemis≥ 3 → Nuage renforcé (plus proche) · ennemis≥ 3 → Nuage pestilentiel (plus proche) · cible n'a pas Lien vital → Lien vital (plus fort) · cible n'a pas Malédiction → Malédiction de faiblesse (plus fort) · toujours → Terreur de masse (plus proche) · toujours → Murmure de terreur (moins volontaire) · toujours → Drain de vie (plus proche) · toujours → Emploi d'arme (plus proche) · toujours → Attendre
- **Mineurs de fond** (`mineurs`, attaque de base : Emploi d'arme) : én.< 15% → Repos · ennemis≥ 3 → Frappe sismique (plus proche) · én.≥ 40% → Coup de massue (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Forgeron des runes** (`forgeron_runes`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Cri de guerre → Chant de guerre · n'a pas Garde → Bénédiction · én.≥ 60% → Coup de tonnerre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Éclaireuse des galeries** (`eclaireuse`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Hâte → Hâte · toujours → Assassinat (plus faible) · én.≥ 40% → Lame d'ombre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Alchimiste** (`alchimiste`, attaque de base : Tir de fronde) : vol.< 45% → Méditation · cible n'a pas Poison → Tir empoisonné (plus fort) · ennemis≥ 3 → Pluie de feu (plus proche) · én.≥ 40% → Flèche enflammée (plus faible) · toujours → Tir de fronde (plus faible) · toujours → Attendre
- **Gardien de pierre** (`gardien_pierre`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Provocation → Provocation · n'a pas Épines → Carapace d'épines · ennemis≥ 3 → Frappe sismique (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Mage de cristal** (`mage_cristal`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · cible n'a pas Silence → Mot de silence (plus fort) · ennemis≥ 3 → Tempête de givre (plus proche) · toujours → Éclat de glace (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Lanciers des cendres** (`lanciers_cendres`, attaque de base : Emploi d'arme) : én.< 15% → Repos · cible n'a pas Ralenti → Coup au jarret (plus proche) · ennemis≥ 3 → Frappe sismique (plus proche) · én.≥ 40% → Charge (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Nomade des sables** (`nomade`, attaque de base : Tir à l'arc) : én.< 15% → Repos · én.≥ 60% → Tir repoussant (plus proche) · én.≥ 40% → Flèche enflammée (plus faible) · én.≥ 40% → Tir précis (plus faible) · toujours → Tir à l'arc (plus faible) · toujours → Attendre
- **Derviche** (`derviche`, attaque de base : Emploi d'arme) : én.< 20% → Second souffle · n'a pas Hâte → Hâte · ennemis≥ 3 → Tourbillon · én.≥ 40% → Lame d'ombre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Prêtresse du soleil** (`pretresse_soleil`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · PV allié< 55% → Soin majeur (allié le plus blessé) · n'a pas Garde → Bénédiction · toujours → Javelot de lumière (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Scorpions dressés** (`scorpions`, attaque de base : Morsure) : én.< 15% → Repos · n'a pas Épines → Carapace d'épines · cible n'a pas Poison → Morsure venimeuse (plus fort) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Mage de cendre** (`mage_cendre`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · ennemis≥ 3 → Pluie de feu (plus proche) · ennemis≥ 3 → Éruption (plus proche) · toujours → Trait de flammes (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Garde de l'oasis** (`garde_oasis`, attaque de base : Emploi d'arme) : én.< 15% → Repos · PV allié< 50% → Mur de boucliers · n'a pas Provocation → Provocation · n'a pas Épines → Carapace d'épines · én.≥ 60% → Coup de tonnerre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Barde du désert** (`barde`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · n'a pas Cri de guerre → Chant de guerre · n'a pas Hâte → Vent rapide · én.≥ 60% → Cri d'effroi (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Paladin de l'aube** (`paladin`, attaque de base : Emploi d'arme) : PV allié< 55% → Soin mineur (allié le plus blessé) · n'a pas Garde → Bénédiction · n'a pas Provocation → Provocation · én.≥ 60% → Coup de tonnerre (plus proche) · toujours → Javelot de lumière (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Archonte** (`archonte_aube`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · PV allié< 50% → Cercle de soins · cible n'a pas Silence → Mot de silence (plus fort) · ennemis≥ 3 → Nova sacrée (plus proche) · toujours → Javelot de lumière (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Lames jumelles** (`lames_jumelles`, attaque de base : Emploi d'arme) : én.< 15% → Repos · toujours → Assassinat (plus faible) · cible n'a pas Ralenti → Coup au jarret (plus proche) · én.≥ 40% → Lame d'ombre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Tireur astral** (`tireur_astral`, attaque de base : Tir à l'arc) : én.< 15% → Repos · cible n'a pas Marque → Marque du chasseur (plus fort) · ennemis≥ 3 → Tir perforant (plus proche) · én.≥ 40% → Tir précis (plus faible) · toujours → Tir à l'arc (plus faible) · toujours → Attendre
- **Oracle** (`oracle`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · cible n'a pas Affaibli → Affaiblissement (plus fort) · cible n'a pas Silence → Mot de silence (plus fort) · ennemis≥ 3 → Terreur de masse (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Chevalier-griffon** (`chevalier_griffon`, attaque de base : Emploi d'arme) : én.< 15% → Repos · ennemis≥ 3 → Frappe sismique (plus proche) · én.≥ 40% → Charge (plus faible) · én.≥ 40% → Coup de massue (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Invocatrice des tempêtes** (`invocatrice`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · ennemis≥ 3 → Tempête de givre (plus proche) · ennemis≥ 3 → Éruption (plus proche) · toujours → Éclat de glace (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Gardiens célestes** (`gardiens_celestes`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Provocation → Provocation · n'a pas Épines → Carapace d'épines · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Gobelins pillards** (`gobelins`, attaque de base : Emploi d'arme) : én.< 15% → Repos · cible n'a pas Saignement → Lame saignante (plus faible) · én.≥ 60% → Exploit d'arme (plus faible) · toujours → Emploi d'arme (plus faible) · aucun ennemi à portée → Avancer
- **Gobelins frondeurs** (`frondeurs_gob`, attaque de base : Tir de fronde) : én.< 15% → Repos · cible n'a pas Marque → Marque du chasseur (plus fort) · toujours → Tir de fronde (plus faible) · aucun ennemi à portée → Avancer
- **Loup gris** (`loup_gris`, attaque de base : Morsure) : én.< 10% → Repos · vol.< 60% → Hurlement · toujours → Charge (plus faible) · toujours → Morsure (plus faible) · aucun ennemi à portée → Avancer
- **Araignée des ronces** (`araignee`, attaque de base : Emploi d'arme) : én.< 15% → Repos · cible n'a pas Poison → Nuage pestilentiel (plus proche) · én.≥ 70% → Grappin (plus fort) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer
- **Chaman gobelin** (`chaman`, attaque de base : Emploi d'arme) : PV allié< 50% → Soin mineur (allié le plus blessé) · cible n'a pas Malédiction → Malédiction de faiblesse (plus fort) · toujours → Murmure de terreur (moins volontaire) · toujours → Trait de flammes (plus faible) · toujours → Emploi d'arme (plus proche) · toujours → Attendre
- **Troll des fourrés** (`troll`, attaque de base : Emploi d'arme) : én.< 15% → Repos · én.≥ 50% → Exploit d'arme (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer
- **Sylvain des Ronces** (`sylvain`, attaque de base : Emploi d'arme) : én.< 15% → Repos · PV< 50% → Régénération · cible n'a pas Brise-armure → Brise-armure (plus fort) · én.≥ 70% → Repousser (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer
- **Loup alpha** (`loup_alpha`, attaque de base : Morsure) : én.< 15% → Repos · vol.< 45% → Hurlement · én.≥ 40% → Charge (plus faible) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Nuée de corbeaux** (`corbeaux`, attaque de base : Morsure) : én.< 15% → Repos · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Noyés** (`noyes`, attaque de base : Emploi d'arme) : én.< 15% → Repos · cible n'a pas Saignement → Lame saignante (plus fort) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Crapaud géant** (`crapaud`, attaque de base : Morsure) : én.< 15% → Repos · cible n'a pas Poison → Morsure venimeuse (plus fort) · cible n'a pas Ralenti → Jet de toile (plus proche) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Sangsues géantes** (`sangsues`, attaque de base : Morsure) : toujours → Toucher spectral (plus faible) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Feu follet** (`feu_follet`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · toujours → Trait de flammes (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Hommes-lézards** (`hommes_lezards`, attaque de base : Emploi d'arme) : én.< 15% → Repos · cible n'a pas Ralenti → Coup au jarret (plus proche) · én.≥ 60% → Grappin (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Sorcière noyée** (`sorciere_noyee`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · cible n'a pas Poison → Fléau (plus fort) · cible n'a pas Affaibli → Affaiblissement (plus fort) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Crocodile des fanges** (`crocodile`, attaque de base : Morsure) : én.< 15% → Repos · toujours → Assassinat (plus faible) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Essaim de moustiques** (`moustiques`, attaque de base : Morsure) : cible n'a pas Poison → Morsure venimeuse (plus fort) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Troll des marais** (`troll_marais`, attaque de base : Emploi d'arme) : én.< 15% → Repos · cible n'a pas Régénération → Sève régénératrice (allié le plus blessé) · én.≥ 40% → Coup de massue (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Spectre des brumes** (`spectre_brumes`, attaque de base : Emploi d'arme) : én.≥ 60% → Cri d'effroi (plus proche) · toujours → Toucher spectral (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Pêcheurs maudits** (`pecheurs_maudits`, attaque de base : Emploi d'arme) : én.< 15% → Repos · én.≥ 60% → Grappin (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Mère des Noyés** (`mere_noyes`, attaque de base : Emploi d'arme) : PV allié< 50% → Cercle de soins · cible n'a pas Poison → Fléau (plus fort) · ennemis≥ 3 → Tempête de givre (plus proche) · toujours → Toucher spectral (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Kobolds** (`kobolds`, attaque de base : Emploi d'arme) : én.< 15% → Repos · cible n'a pas Saignement → Lame saignante (plus fort) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Kobold artificier** (`artificier`, attaque de base : Tir de fronde) : én.< 15% → Repos · én.≥ 40% → Flèche enflammée (plus faible) · toujours → Tir de fronde (plus faible) · toujours → Attendre
- **Golem de pierre** (`golem_pierre`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Épines → Carapace d'épines · én.≥ 40% → Coup de massue (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Chauves-souris des puits** (`chauves_souris`, attaque de base : Morsure) : én.< 15% → Repos · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Ver des galeries** (`ver_galeries`, attaque de base : Morsure) : cible n'a pas Poison → Morsure venimeuse (plus fort) · ennemis≥ 3 → Frappe sismique (plus proche) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Nains renégats** (`nains_renegats`, attaque de base : Emploi d'arme) : én.< 15% → Repos · én.≥ 60% → Coup de tonnerre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Élémentaire de cristal** (`elementaire_cristal`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · ennemis≥ 3 → Tempête de givre (plus proche) · toujours → Éclat de glace (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Basilic** (`basilic`, attaque de base : Morsure) : cible n'a pas Affaibli → Affaiblissement (plus fort) · cible n'a pas Poison → Morsure venimeuse (plus fort) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Gelée acide** (`gelee`, attaque de base : Morsure) : cible n'a pas Poison → Morsure venimeuse (plus fort) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Contremaître kobold** (`contremaitre`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Cri de guerre → Chant de guerre · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Mineurs fantômes** (`mineurs_fantomes`, attaque de base : Emploi d'arme) : toujours → Toucher spectral (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Cœur-de-Forge** (`coeur_forge`, attaque de base : Emploi d'arme) : n'a pas Épines → Carapace d'épines · én.≥ 60% → Coup de tonnerre (plus proche) · ennemis≥ 3 → Frappe sismique (plus proche) · ennemis≥ 3 → Éruption (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Scorpions géants** (`scorpions_geants`, attaque de base : Morsure) : én.< 15% → Repos · cible n'a pas Poison → Morsure venimeuse (plus fort) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Momies** (`momies`, attaque de base : Emploi d'arme) : cible n'a pas Poison → Fléau (plus fort) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Djinn mineur** (`djinn`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · ennemis≥ 3 → Pluie de feu (plus proche) · toujours → Trait de flammes (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Pillards des sables** (`pillards_sable`, attaque de base : Emploi d'arme) : én.< 15% → Repos · toujours → Assassinat (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Archers nomades** (`archers_nomades`, attaque de base : Tir à l'arc) : én.< 15% → Repos · én.≥ 40% → Flèche enflammée (plus faible) · toujours → Tir à l'arc (plus faible) · toujours → Attendre
- **Salamandre** (`salamandre`, attaque de base : Emploi d'arme) : én.< 15% → Repos · ennemis≥ 3 → Souffle de feu (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Ver des sables** (`ver_sables`, attaque de base : Morsure) : én.< 15% → Repos · ennemis≥ 3 → Frappe sismique (plus proche) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Vautours** (`vautours`, attaque de base : Morsure) : én.< 15% → Repos · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Ombre du mirage** (`ombre_mirage`, attaque de base : Emploi d'arme) : cible n'a pas Silence → Mot de silence (plus fort) · én.≥ 40% → Lame d'ombre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Golem de verre** (`golem_verre`, attaque de base : Emploi d'arme) : n'a pas Épines → Carapace d'épines · én.≥ 40% → Coup de massue (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Prêtre-scarabée** (`pretre_scarabee`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · PV allié< 55% → Soin mineur (allié le plus blessé) · cible n'a pas Affaibli → Affaiblissement (plus fort) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Dragon de cendre** (`dragon_cendre`, attaque de base : Emploi d'arme) : én.≥ 60% → Cri d'effroi (plus proche) · ennemis≥ 3 → Souffle de feu (plus proche) · ennemis≥ 3 → Éruption (plus proche) · én.≥ 40% → Coup de massue (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Sentinelles de marbre** (`sentinelles`, attaque de base : Emploi d'arme) : én.< 15% → Repos · n'a pas Provocation → Provocation · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Gargouilles** (`gargouilles`, attaque de base : Emploi d'arme) : n'a pas Épines → Carapace d'épines · én.≥ 40% → Coup de massue (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Ange déchu** (`anges_dechus`, attaque de base : Emploi d'arme) : én.≥ 40% → Lame d'ombre (plus proche) · toujours → Toucher spectral (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Harpies célestes** (`harpies`, attaque de base : Morsure) : én.< 15% → Repos · én.≥ 60% → Cri d'effroi (plus proche) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Astromancien** (`astromancien`, attaque de base : Emploi d'arme) : vol.< 45% → Méditation · cible n'a pas Silence → Mot de silence (plus fort) · ennemis≥ 3 → Tempête de givre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Golem astral** (`golem_astral`, attaque de base : Emploi d'arme) : n'a pas Épines → Carapace d'épines · én.≥ 60% → Coup de tonnerre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Griffon sauvage** (`griffons`, attaque de base : Morsure) : én.< 15% → Repos · én.≥ 40% → Charge (plus faible) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Spectres de lumière** (`spectres_lumiere`, attaque de base : Emploi d'arme) : ennemis≥ 3 → Nova sacrée (plus proche) · toujours → Javelot de lumière (plus faible) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Chimère** (`chimere`, attaque de base : Morsure) : cible n'a pas Poison → Morsure venimeuse (plus fort) · ennemis≥ 3 → Souffle de feu (plus proche) · toujours → Morsure (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Archers célestes** (`archers_celestes`, attaque de base : Tir à l'arc) : én.< 15% → Repos · ennemis≥ 3 → Tir perforant (plus proche) · toujours → Tir à l'arc (plus faible) · toujours → Attendre
- **Gardien du seuil** (`gardien_seuil`, attaque de base : Emploi d'arme) : n'a pas Garde → Bénédiction · n'a pas Provocation → Provocation · én.≥ 60% → Coup de tonnerre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre
- **Archonte déchu** (`archonte_dechu`, attaque de base : Emploi d'arme) : PV allié< 50% → Cercle de soins · cible n'a pas Silence → Mot de silence (plus fort) · ennemis≥ 3 → Nova sacrée (plus proche) · ennemis≥ 3 → Éruption (plus proche) · én.≥ 40% → Lame d'ombre (plus proche) · toujours → Emploi d'arme (plus proche) · aucun ennemi à portée → Avancer · toujours → Attendre

Les rares reprennent les règles de leur modèle.

## F. Objets non équipables

| id | Nom | Genre | Palier | Valeur (or) | Étiquettes | Effet / note |
|---|---|---|---|---|---|---|
| bois_tordu | Bois tordu | materiau | 1 | 4 | bois |  |
| resine | Résine collante | materiau | 1 | 4 | bois, essence |  |
| cuir_brut | Cuir brut | materiau | 1 | 5 | cuir, bete |  |
| croc_loup | Croc de loup | materiau | 1 | 6 | bete, os |  |
| oreille_gobelin | Oreille de gobelin | materiau | 1 | 3 | gobelin |  |
| ferraille | Ferraille rouillée | materiau | 1 | 5 | metal, gobelin |  |
| fil_araignee | Fil d'araignée | materiau | 1 | 6 | fil, bete |  |
| champignon_pale | Champignon pâle | materiau | 1 | 4 | herbe |  |
| pierre_lisse | Pierre lisse | materiau | 1 | 3 | pierre |  |
| plume_corbeau | Plume de corbeau | materiau | 1 | 5 | plume, essence |  |
| cuir_epais | Cuir épais | materiau | 2 | 12 | cuir, bete |  |
| venin | Glande à venin | materiau | 2 | 14 | essence, bete |  |
| fer_noir | Fer noir | materiau | 2 | 15 | metal |  |
| seve_ambree | Sève ambrée | materiau | 2 | 12 | bois, essence |  |
| os_ancien | Os ancien | materiau | 2 | 13 | os, pierre |  |
| algue_noire | Algue noire | materiau | 2 | 11 | herbe, essence |  |
| ecaille_terne | Écaille terne | materiau | 2 | 13 | cuir, bete |  |
| tourbe | Tourbe compacte | materiau | 2 | 10 | bois, pierre |  |
| plume_heron | Plume de héron | materiau | 2 | 12 | plume |  |
| minerai_argent | Minerai d'argent | materiau | 3 | 28 | metal |  |
| cristal_brut | Cristal brut | materiau | 3 | 30 | pierre, essence |  |
| charbon_dense | Charbon dense | materiau | 3 | 24 | pierre, bois |  |
| cuir_basilic | Cuir de basilic | materiau | 3 | 29 | cuir, bete |  |
| soie_profonde | Soie des profondeurs | materiau | 3 | 27 | fil |  |
| soufre | Soufre | materiau | 3 | 25 | essence, pierre |  |
| verre_cendre | Verre de cendre | materiau | 4 | 50 | pierre, metal |  |
| sel_ardent | Sel ardent | materiau | 4 | 46 | essence |  |
| os_dragonnet | Os de dragonnet | materiau | 4 | 55 | os, bete |  |
| ecorce_cendre | Écorce de cendre | materiau | 4 | 45 | bois |  |
| essence_mirage | Essence de mirage | materiau | 4 | 52 | essence, fil |  |
| chitine_doree | Chitine dorée | materiau | 4 | 50 | cuir, os |  |
| plume_seraphique | Plume séraphique | materiau | 5 | 90 | plume, fil |  |
| eclat_astral | Éclat astral | materiau | 5 | 95 | metal, pierre |  |
| pierre_lune | Pierre de lune | materiau | 5 | 85 | pierre |  |
| poussiere_etoile | Poussière d'étoile | materiau | 5 | 88 | essence |  |
| larme_aube | Larme d'aube | materiau | 5 | 92 | essence, herbe |  |
| fil_lumiere | Fil de lumière | materiau | 5 | 86 | fil |  |
| totem_gobelin | Totem gobelin | composant | 2 | 25 | gobelin, essence | Composant rare du camp gobelin. |
| coeur_ronce | Cœur de ronce | composant | 3 | 45 | bois, essence | Composant du gardien des Ronces. |
| perle_noyee | Perle noyée | composant | 3 | 35 | essence | Composant rare du Marais des Noyés. |
| coeur_marais | Cœur du marais | composant | 3 | 60 | essence, herbe | Composant de la Mère des Noyés. |
| noyau_golem | Noyau de golem | composant | 4 | 60 | pierre, metal | Composant rare des mines. |
| gemme_profonde | Gemme profonde | composant | 4 | 90 | pierre, essence | Composant du Cœur-de-Forge. |
| flamme_figee | Flamme figée | composant | 5 | 100 | essence | Composant rare du désert. |
| coeur_dragon | Cœur de dragon | composant | 5 | 140 | bete, essence | Composant du Dragon de cendre. |
| plume_archonte | Plume d'archonte | composant | 5 | 110 | plume, essence | Composant rare des Ruines Célestes. |
| couronne_aube | Couronne de l'aube | composant | 5 | 180 | metal, essence | Composant de l'Archonte déchu. |
| bandage | Bandage | consommable | 1 | 6 | — | +15 % des PV max (PV +15 %) |
| potion_mineure | Potion de soin mineure | consommable | 1 | 12 | — | +30 % des PV max (PV +30 %) |
| potion_soin | Potion de soin | consommable | 2 | 25 | — | +50 % des PV max (PV +50 %) |
| potion_mana | Potion de mana mineure | consommable | 1 | 12 | — | +40 % du mana max (mana +40 %) |
| potion_mana_normale | Potion de mana | consommable | 2 | 25 | — | +80 % du mana max (mana +80 %) |
| potion_majeure | Potion de soin majeure | consommable | 3 | 50 | — | +80 % des PV max (PV +80 %) |
| tonique | Tonique | consommable | 3 | 40 | — | +25 % des PV et du mana max (PV +25 %, mana +25 %) |
| onguent | Onguent de remise | consommable | 5 | 90 | — | Soigne entièrement une unité (butin rare) (PV +100 %) |
| fourrure_givre | Fourrure de Croc-de-Givre | trophee | 1 | 20 | — | Trophée de Croc-de-Givre (Forêt des Ronces). Demandé par les quêtes des villes. |
| banniere_grishnak | Bannière de Grishnak | trophee | 1 | 20 | — | Trophée de Grishnak le Balafré (Forêt des Ronces). Demandé par les quêtes des villes. |
| oeuf_reine_soie | Œuf de Reine-Soie | trophee | 1 | 20 | — | Trophée de Reine-Soie (Forêt des Ronces). Demandé par les quêtes des villes. |
| oeil_machefer | Œil de Mâchefer | trophee | 1 | 20 | — | Trophée de Vieux Mâchefer (Forêt des Ronces). Demandé par les quêtes des villes. |
| langue_vase | Langue de Gueule-de-Vase | trophee | 2 | 80 | — | Trophée de Gueule-de-Vase (Marais des Noyés). Demandé par les quêtes des villes. |
| crane_ssark | Crâne peint de Ssark | trophee | 2 | 80 | — | Trophée de Ssark l’Écorcheur (Marais des Noyés). Demandé par les quêtes des villes. |
| lanterne_capitaine | Lanterne du Capitaine | trophee | 2 | 80 | — | Trophée de Capitaine sans visage (Marais des Noyés). Demandé par les quêtes des villes. |
| dent_mangeur | Dent du Mangeur-de-Barques | trophee | 2 | 80 | — | Trophée de Mangeur-de-Barques (Marais des Noyés). Demandé par les quêtes des villes. |
| detonateur | Détonateur de Brûle-Mèche | trophee | 3 | 180 | — | Trophée de Brûle-Mèche (Mines de Fer-Hurlant). Demandé par les quêtes des villes. |
| mandibule_ver | Mandibule du Grand Ver | trophee | 3 | 180 | — | Trophée de Grand Ver blanc (Mines de Fer-Hurlant). Demandé par les quêtes des villes. |
| coeur_prisme | Cœur de prisme | trophee | 3 | 180 | — | Trophée de Prisme vivant (Mines de Fer-Hurlant). Demandé par les quêtes des villes. |
| oeil_or | Œil d’or | trophee | 3 | 180 | — | Trophée de Basilic à l’œil d’or (Mines de Fer-Hurlant). Demandé par les quêtes des villes. |
| voile_mirage | Voile du Mirage jumeau | trophee | 4 | 320 | — | Trophée de Mirage jumeau (Désert de Cendre). Demandé par les quêtes des villes. |
| sceau_main_rouge | Sceau de Main-Rouge | trophee | 4 | 320 | — | Trophée de Khaled Main-Rouge (Désert de Cendre). Demandé par les quêtes des villes. |
| scarabee_or | Scarabée d’or d’Ankhaset | trophee | 4 | 320 | — | Trophée de Grand prêtre Ankhaset (Désert de Cendre). Demandé par les quêtes des villes. |
| perle_ver_roi | Perle du Ver-Roi | trophee | 4 | 320 | — | Trophée de Ver-Roi des sables (Désert de Cendre). Demandé par les quêtes des villes. |
| remige_argent | Rémige d’argent | trophee | 5 | 500 | — | Trophée de Griffon aux ailes d’argent (Ruines Célestes). Demandé par les quêtes des villes. |
| glyphe_vigilance | Glyphe de vigilance | trophee | 5 | 500 | — | Trophée de Sentinelle éveillée (Ruines Célestes). Demandé par les quêtes des villes. |
| astrolabe_brise | Astrolabe brisé | trophee | 5 | 500 | — | Trophée de Astromancien fou (Ruines Célestes). Demandé par les quêtes des villes. |
| corne_chimere | Corne de chimère | trophee | 5 | 500 | — | Trophée de Chimère à trois têtes (Ruines Célestes). Demandé par les quêtes des villes. |

## G. Bases d’équipement (75)

Budget par palier : p1 10, p2 20, p3 35, p4 55, p5 80 points ; nombre de stats : p1 2, p2 2, p3 3, p4 3, p5 4 ; niveau requis : p1 1, p2 6, p3 11, p4 16, p5 21.
Coût d’un point de budget : Attaque 1 par point, PV max 5 par point, Volonté max 3 par point, Énergie max 4 par point, Mana max 3 par point, Résistance 2 par point, Dégâts de l'arme 1 par point, Vitesse de l'arme 0.25 par point, Coût en énergie de l'arme 0.5 par point.

| id | Nom | Palier | Emplacement | Catégorie | Valeur | Arme (type dégâts/vitesse/coût) | Pool de stats (poids) | Nb stats | Craft |
|---|---|---|---|---|---|---|---|---|---|
| lame_1 | Épée courte | 1 | arme | une_main | 30 | tranchant 12/20/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 2 | partout |
| lame_2 | Lame de fer noir | 2 | arme | une_main | 70 | tranchant 15/20/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 2 | partout |
| lame_3 | Épée d'argent | 3 | arme | une_main | 140 | tranchant 19/20/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 3 | partout |
| lame_4 | Cimeterre de cendre | 4 | arme | une_main | 260 | feu 23/20/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 3 | atelier de Cendrelune |
| lame_5 | Lame de l'aube | 5 | arme | une_main | 450 | sacre 28/20/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 4 | atelier de Sanctuaire de l'Aube |
| masse_1 | Masse cloutée | 1 | arme | une_main | 30 | contondant 10/21/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 2 | partout |
| masse_2 | Masse de fer noir | 2 | arme | une_main | 70 | contondant 13/21/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 2 | partout |
| masse_3 | Marteau runique | 3 | arme | une_main | 140 | contondant 16/21/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 3 | partout |
| masse_4 | Masse de verre-cendre | 4 | arme | une_main | 260 | contondant 19/21/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 3 | atelier de Cendrelune |
| masse_5 | Étoile du matin | 5 | arme | une_main | 450 | contondant 23/21/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 4 | atelier de Sanctuaire de l'Aube |
| deuxmains_1 | Hache de bûcheron | 1 | arme | deux_mains | 30 | tranchant 16/24/14 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, hp 1 | 2 | partout |
| deuxmains_2 | Hache des fanges | 2 | arme | deux_mains | 70 | tranchant 20/24/14 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, hp 1 | 2 | partout |
| deuxmains_3 | Grand marteau nain | 3 | arme | deux_mains | 140 | contondant 25/24/14 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, hp 1 | 3 | partout |
| deuxmains_4 | Fauchard de cendre | 4 | arme | deux_mains | 260 | tranchant 30/24/14 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, hp 1 | 3 | atelier de Cendrelune |
| deuxmains_5 | Lance céleste | 5 | arme | deux_mains | 450 | tranchant 37/24/14 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, hp 1 | 4 | atelier de Sanctuaire de l'Aube |
| fronde_1 | Fronde tressée | 1 | arme | fronde | 30 | contondant 8/18/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 2 | partout |
| fronde_2 | Fronde en cuir épais | 2 | arme | fronde | 70 | contondant 10/18/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 2 | partout |
| fronde_3 | Lance-pierre d'argent | 3 | arme | fronde | 140 | contondant 12/18/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 3 | partout |
| fronde_4 | Fronde à soufre | 4 | arme | fronde | 260 | feu 15/18/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 3 | atelier de Cendrelune |
| fronde_5 | Fronde stellaire | 5 | arme | fronde | 450 | sacre 18/18/8 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 4 | atelier de Sanctuaire de l'Aube |
| arc_1 | Arc de frêne | 1 | arme | arc | 30 | tranchant 10/18/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 2 | partout |
| arc_2 | Arc des marais | 2 | arme | arc | 70 | tranchant 13/18/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 2 | partout |
| arc_3 | Arc composite d'argent | 3 | arme | arc | 140 | tranchant 16/18/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 3 | partout |
| arc_4 | Arc du désert | 4 | arme | arc | 260 | tranchant 19/18/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 3 | atelier de Cendrelune |
| arc_5 | Arc astral | 5 | arme | arc | 450 | tranchant 23/18/10 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 4 | atelier de Sanctuaire de l'Aube |
| baton_1 | Bâton noueux | 1 | arme | baton | 30 | contondant 6/22/6 | mana 3, will 2, wdmg 1, atk 1, res 1 | 2 | partout |
| baton_2 | Bâton de sève | 2 | arme | baton | 70 | contondant 8/22/6 | mana 3, will 2, wdmg 1, atk 1, res 1 | 2 | partout |
| baton_3 | Bâton de cristal | 3 | arme | baton | 140 | glace 9/22/6 | mana 3, will 2, wdmg 1, atk 1, res 1 | 3 | partout |
| baton_4 | Bâton de braise | 4 | arme | baton | 260 | feu 11/22/6 | mana 3, will 2, wdmg 1, atk 1, res 1 | 3 | atelier de Cendrelune |
| baton_5 | Sceptre de l'aube | 5 | arme | baton | 450 | sacre 14/22/6 | mana 3, will 2, wdmg 1, atk 1, res 1 | 4 | atelier de Sanctuaire de l'Aube |
| gantelets_1 | Gantelets cloutés | 1 | arme | gantelets | 30 | contondant 8/14/6 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 2 | partout |
| gantelets_2 | Poings écaillés | 2 | arme | gantelets | 70 | contondant 10/14/6 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 2 | partout |
| gantelets_3 | Gantelets runiques | 3 | arme | gantelets | 140 | contondant 12/14/6 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 3 | partout |
| gantelets_4 | Griffes de verre | 4 | arme | gantelets | 260 | contondant 15/14/6 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 3 | atelier de Cendrelune |
| gantelets_5 | Gantelets séraphiques | 5 | arme | gantelets | 450 | contondant 18/14/6 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1, will 1 | 4 | atelier de Sanctuaire de l'Aube |
| legere_1 | Gilet de cuir | 1 | armure | legere | 30 | — | hp 3, energy 2, res:tranchant 2, res:contondant 1, res 1 | 2 | partout |
| legere_2 | Veste d'écailles | 2 | armure | legere | 70 | — | hp 3, energy 2, res:tranchant 2, res:contondant 1, res 1 | 2 | partout |
| legere_3 | Cuir de basilic | 3 | armure | legere | 140 | — | hp 3, energy 2, res:tranchant 2, res:contondant 1, res 1 | 3 | partout |
| legere_4 | Tunique de chitine | 4 | armure | legere | 260 | — | hp 3, energy 2, res:tranchant 2, res:contondant 1, res 1 | 3 | atelier de Cendrelune |
| legere_5 | Cuirasse de plumes | 5 | armure | legere | 450 | — | hp 3, energy 2, res:tranchant 2, res:contondant 1, res 1 | 4 | atelier de Sanctuaire de l'Aube |
| moyenne_1 | Brigandine usée | 1 | armure | moyenne | 30 | — | hp 3, res:tranchant 3, res:contondant 2, will 1, res 1 | 2 | partout |
| moyenne_2 | Cotte de mailles | 2 | armure | moyenne | 70 | — | hp 3, res:tranchant 3, res:contondant 2, will 1, res 1 | 2 | partout |
| moyenne_3 | Maille d'argent | 3 | armure | moyenne | 140 | — | hp 3, res:tranchant 3, res:contondant 2, will 1, res 1 | 3 | partout |
| moyenne_4 | Écailles de dragonnet | 4 | armure | moyenne | 260 | — | hp 3, res:tranchant 3, res:contondant 2, will 1, res 1 | 3 | atelier de Cendrelune |
| moyenne_5 | Haubert lunaire | 5 | armure | moyenne | 450 | — | hp 3, res:tranchant 3, res:contondant 2, will 1, res 1 | 4 | atelier de Sanctuaire de l'Aube |
| lourde_1 | Plastron de ferraille | 1 | armure | lourde | 30 | — | hp 4, res:tranchant 3, res:contondant 3, res 1 | 2 | partout |
| lourde_2 | Armure de fer noir | 2 | armure | lourde | 70 | — | hp 4, res:tranchant 3, res:contondant 3, res 1 | 2 | partout |
| lourde_3 | Plaques naines | 3 | armure | lourde | 140 | — | hp 4, res:tranchant 3, res:contondant 3, res 1 | 3 | partout |
| lourde_4 | Armure de verre-cendre | 4 | armure | lourde | 260 | — | hp 4, res:tranchant 3, res:contondant 3, res 1 | 3 | atelier de Cendrelune |
| lourde_5 | Plate de l'aube | 5 | armure | lourde | 450 | — | hp 4, res:tranchant 3, res:contondant 3, res 1 | 4 | atelier de Sanctuaire de l'Aube |
| robe_1 | Robe de lin | 1 | armure | robe | 30 | — | mana 3, will 2, hp 1, res 1 | 2 | partout |
| robe_2 | Robe d'algues | 2 | armure | robe | 70 | — | mana 3, will 2, hp 1, res 1 | 2 | partout |
| robe_3 | Robe de soie profonde | 3 | armure | robe | 140 | — | mana 3, will 2, hp 1, res 1 | 3 | partout |
| robe_4 | Robe de mirage | 4 | armure | robe | 260 | — | mana 3, will 2, hp 1, res 1 | 3 | atelier de Cendrelune |
| robe_5 | Robe étoilée | 5 | armure | robe | 450 | — | mana 3, will 2, hp 1, res 1 | 4 | atelier de Sanctuaire de l'Aube |
| bottes_1 | Bottes rapiécées | 1 | accessoire | bottes | 26 | — | hp 2, energy 2, res:contondant 1, will 1 | 2 | partout |
| bottes_2 | Bottes de marais | 2 | accessoire | bottes | 60 | — | hp 2, energy 2, res:contondant 1, will 1 | 2 | partout |
| bottes_3 | Bottes de mineur | 3 | accessoire | bottes | 119 | — | hp 2, energy 2, res:contondant 1, will 1 | 3 | partout |
| bottes_4 | Sandales du désert | 4 | accessoire | bottes | 221 | — | hp 2, energy 2, res:contondant 1, will 1 | 3 | atelier de Cendrelune |
| bottes_5 | Bottes ailées | 5 | accessoire | bottes | 383 | — | hp 2, energy 2, res:contondant 1, will 1 | 4 | atelier de Sanctuaire de l'Aube |
| anneau_1 | Anneau de cuivre | 1 | accessoire | anneau | 26 | — | mana 2, will 2, atk 1, res 2 | 2 | partout |
| anneau_2 | Anneau d'ambre | 2 | accessoire | anneau | 60 | — | mana 2, will 2, atk 1, res 2 | 2 | partout |
| anneau_3 | Anneau de cristal | 3 | accessoire | anneau | 119 | — | mana 2, will 2, atk 1, res 2 | 3 | partout |
| anneau_4 | Anneau de sel ardent | 4 | accessoire | anneau | 221 | — | mana 2, will 2, atk 1, res 2 | 3 | atelier de Cendrelune |
| anneau_5 | Anneau de pierre de lune | 5 | accessoire | anneau | 383 | — | mana 2, will 2, atk 1, res 2 | 4 | atelier de Sanctuaire de l'Aube |
| collier_1 | Collier à pointes | 1 | accessoire | collier | 26 | — | atk 2, hp 2, energy 1, res 1 | 2 | partout |
| collier_2 | Collier d'écailles | 2 | accessoire | collier | 60 | — | atk 2, hp 2, energy 1, res 1 | 2 | partout |
| collier_3 | Collier d'argent | 3 | accessoire | collier | 119 | — | atk 2, hp 2, energy 1, res 1 | 3 | partout |
| collier_4 | Collier de chitine | 4 | accessoire | collier | 221 | — | atk 2, hp 2, energy 1, res 1 | 3 | atelier de Cendrelune |
| collier_5 | Collier d'étoiles | 5 | accessoire | collier | 383 | — | atk 2, hp 2, energy 1, res 1 | 4 | atelier de Sanctuaire de l'Aube |
| ecorce_vivante | Armure d’écorce vivante | 2 | armure | moyenne | 110 | — | hp 3, res:tranchant 2, res:feu 2, energy 1 | 3 | non (butin de gardien) |
| cape_noyes | Cape des Noyés | 3 | accessoire | anneau | 220 | — | mana 2, will 2, res:maladie 2, res:glace 2, hp 1 | 4 | non (butin de gardien) |
| poings_forge | Poings du Cœur-de-Forge | 4 | arme | gantelets | 400 | feu 17/14/6 | atk 3, wdmg 3, wspeed 1, wcost 2, energy 1 | 4 | non (butin de gardien) |
| ecailles_dragon | Écailles du dragon de cendre | 5 | armure | lourde | 650 | — | hp 4, res:feu 3, res:tranchant 3, res:contondant 2, energy 1 | 5 | non (butin de gardien) |
| diademe_aube | Diadème de l'aube | 5 | accessoire | anneau | 650 | — | mana 2, will 2, atk 2, hp 2, res 1 | 5 | non (butin de gardien) |

## H. Régions, villes, étapes

### 1. Pays de Havre-Gris : Havre-Gris / Forêt des Ronces

Palier 1, niveau minimal 1. Ville : Capitale de la région. Banque, atelier, recrutement, temple et marchand.
Recrutement : Milicien, Chasseur, Acolyte, Frondeurs, Novice du monastère, Écuyer, Herboriste, Braconniers.
Marchand : Épée courte, Bâton noueux, Arc de frêne, Gilet de cuir, Robe de lin, Bandage, Potion de soin mineure.
Objet de première victoire sur le gardien : Cœur de ronce. Butin réservé au gardien : Armure d’écorce vivante. Renfort des monstres : PV ×1.25, attaque et dégâts d’arme ×1.2, gardien ×1 en plus.
Territoire : Une forêt étouffée de ronces où gobelins, bêtes et araignées se disputent les sentiers. Le Sylvain qui garde son cœur barre la route du marais.

| # | Étape | Niveaux (bonus +2 inclus) | Pop. | Pool de monstres | Imposé | Tirages de butin | Or de base | Matériaux d’étape | Rare |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Lisière (`lisiere`) | 3-4 | 1-2 | Loup gris, Gobelins pillards, Gobelins frondeurs, Nuée de corbeaux | — | 1-2 | 8 | Bois tordu, Pierre lisse, Champignon pâle | Croc-de-Givre (modèle Loup gris, trophée Fourrure de Croc-de-Givre) |
| 2 | Sentier des pillards (`sentier`) | 4-5 | 2-3 | Gobelins pillards, Gobelins frondeurs, Loup gris, Nuée de corbeaux | — | 1-2 | 12 | Bois tordu, Résine collante, Plume de corbeau | Grishnak le Balafré (modèle Gobelins pillards, trophée Bannière de Grishnak) |
| 3 | Nids de soie (`nids`) | 5-6 | 3-5 | Araignée des ronces, Loup gris, Gobelins frondeurs, Loup alpha | — | 2-2 | 16 | Résine collante, Fil d'araignée, Champignon pâle | Reine-Soie (modèle Araignée des ronces, trophée Œuf de Reine-Soie) |
| 4 | Camp gobelin (`camp`) | 6-7 | 5-7 | Gobelins pillards, Gobelins frondeurs, Chaman gobelin, Troll des fourrés | — | 2-2 | 22 | Ferraille rouillée, Fer noir, Plume de corbeau | Vieux Mâchefer (modèle Troll des fourrés, trophée Œil de Mâchefer) |
| 5 | Cœur des Ronces (`coeur`) | 8-9 | 8-9 | Loup gris, Araignée des ronces, Loup alpha | Sylvain des Ronces | 2-3 + 1 garanti | 40 | Sève ambrée, Os ancien, Résine collante | — |

### 2. Côte de Port-Salant : Port-Salant / Marais des Noyés

Palier 2, niveau minimal 6. Ville : Port de pêcheurs adossé au marais, ses quais sentent la vase et le goudron.
Recrutement : Apprenti pyromancien, Loups jumeaux, Berserker, Harponneur, Sorcière des marais, Gardes de la marée, Arbalétrier, Chamane des crues.
Marchand : Lame de fer noir, Hache des fanges, Arc des marais, Cotte de mailles, Robe d'algues, Bandage, Potion de soin mineure, Potion de soin, Potion de mana mineure.
Objet de première victoire sur le gardien : Cœur du marais. Butin réservé au gardien : Cape des Noyés. Renfort des monstres : PV ×1.7, attaque et dégâts d’arme ×1.5, gardien ×1 en plus.
Territoire : Des eaux noires où les morts ne restent pas couchés. Au centre, la Mère des Noyés.

| # | Étape | Niveaux (bonus +2 inclus) | Pop. | Pool de monstres | Imposé | Tirages de butin | Or de base | Matériaux d’étape | Rare |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Berges (`berges`) | 8-9 | 2-3 | Essaim de moustiques, Crapaud géant, Sangsues géantes, Hommes-lézards | — | 1-2 | 32 | Algue noire, Tourbe compacte, Glande à venin | Gueule-de-Vase (modèle Crapaud géant, trophée Langue de Gueule-de-Vase) |
| 2 | Roselières (`roselieres`) | 9-10 | 3-4 | Hommes-lézards, Feu follet, Crapaud géant, Pêcheurs maudits | — | 1-2 | 48 | Écaille terne, Plume de héron, Algue noire | Ssark l’Écorcheur (modèle Hommes-lézards, trophée Crâne peint de Ssark) |
| 3 | Cimetière des épaves (`epaves`) | 10-11 | 3-5 | Noyés, Pêcheurs maudits, Spectre des brumes, Sangsues géantes | — | 2-2 | 64 | Fer noir, Algue noire, Os ancien | Capitaine sans visage (modèle Pêcheurs maudits, trophée Lanterne du Capitaine) |
| 4 | Tertre de la sorcière (`tertre`) | 11-12 | 5-7 | Sorcière noyée, Crocodile des fanges, Troll des marais, Noyés | — | 2-2 | 88 | Tourbe compacte, Sève ambrée, Écaille terne | Mangeur-de-Barques (modèle Crocodile des fanges, trophée Dent du Mangeur-de-Barques) |
| 5 | Gouffre des Noyés (`gouffre`) | 13-14 | 6-7 | Noyés, Spectre des brumes, Sangsues géantes | Mère des Noyés | 2-3 + 1 garanti | 160 | Algue noire, Perle noyée, Plume de héron | — |

### 3. Monts de Rochecreuse : Rochecreuse / Mines de Fer-Hurlant

Palier 3, niveau minimal 11. Ville : Cité naine creusée dans la montagne, forges allumées jour et nuit.
Recrutement : Briseur, Adepte des ombres, Mineurs de fond, Forgeron des runes, Éclaireuse des galeries, Alchimiste, Gardien de pierre, Mage de cristal.
Marchand : Marteau runique, Lance-pierre d'argent, Gantelets runiques, Plaques naines, Robe de soie profonde, Bandage, Potion de soin mineure, Potion de soin, Potion de mana mineure.
Objet de première victoire sur le gardien : Gemme profonde. Butin réservé au gardien : Poings du Cœur-de-Forge. Renfort des monstres : PV ×2.3, attaque et dégâts d’arme ×1.9, gardien ×1.05 en plus.
Territoire : Des galeries abandonnées par les nains, reprises par les kobolds et pire encore.

| # | Étape | Niveaux (bonus +2 inclus) | Pop. | Pool de monstres | Imposé | Tirages de butin | Or de base | Matériaux d’étape | Rare |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Entrée des mines (`entree`) | 13-14 | 2-3 | Kobolds, Chauves-souris des puits, Kobold artificier, Gelée acide | — | 1-2 | 72 | Charbon dense, Minerai d'argent, Soufre | Brûle-Mèche (modèle Kobold artificier, trophée Détonateur de Brûle-Mèche) |
| 2 | Galeries effondrées (`galeries`) | 14-15 | 3-4 | Ver des galeries, Kobolds, Contremaître kobold, Gelée acide | — | 1-2 | 108 | Soie des profondeurs, Charbon dense, Cuir de basilic | Grand Ver blanc (modèle Ver des galeries, trophée Mandibule du Grand Ver) |
| 3 | Filons de cristal (`filons`) | 15-16 | 3-5 | Élémentaire de cristal, Nains renégats, Mineurs fantômes, Kobold artificier | — | 2-2 | 144 | Cristal brut, Minerai d'argent, Soufre | Prisme vivant (modèle Élémentaire de cristal, trophée Cœur de prisme) |
| 4 | Puits du basilic (`puits`) | 16-17 | 5-7 | Basilic, Golem de pierre, Nains renégats, Mineurs fantômes | — | 2-2 | 198 | Cuir de basilic, Cristal brut, Soie des profondeurs | Basilic à l’œil d’or (modèle Basilic, trophée Œil d’or) |
| 5 | Forge oubliée (`forge`) | 18-19 | 8-9 | Golem de pierre, Kobolds, Kobold artificier | Cœur-de-Forge | 2-3 + 1 garanti | 360 | Minerai d'argent, Cristal brut, Charbon dense | — |

### 4. Terres de Cendrelune : Cendrelune / Désert de Cendre

Palier 4, niveau minimal 16. Ville : Oasis fortifiée au bord du désert, carrefour des caravanes.
Recrutement : Lanciers des cendres, Nomade des sables, Derviche, Prêtresse du soleil, Scorpions dressés, Mage de cendre, Garde de l'oasis, Barde du désert.
Marchand : Cimeterre de cendre, Arc du désert, Bâton de braise, Tunique de chitine, Écailles de dragonnet, Bandage, Potion de soin mineure, Potion de soin, Potion de mana mineure.
Objet de première victoire sur le gardien : Cœur de dragon. Butin réservé au gardien : Écailles du dragon de cendre. Renfort des monstres : PV ×4.5, attaque et dégâts d’arme ×3.2, gardien ×0.48 en plus.
Territoire : Dunes grises et ruines brûlées. Un dragon dort sous la plus haute.

| # | Étape | Niveaux (bonus +2 inclus) | Pop. | Pool de monstres | Imposé | Tirages de butin | Or de base | Matériaux d’étape | Rare |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Dunes grises (`dunes`) | 18-19 | 3-4 | Vautours, Scorpions géants, Archers nomades, Ombre du mirage | — | 1-2 | 128 | Sel ardent, Écorce de cendre, Chitine dorée | Mirage jumeau (modèle Ombre du mirage, trophée Voile du Mirage jumeau) |
| 2 | Piste des caravanes (`caravane`) | 19-20 | 4-5 | Pillards des sables, Archers nomades, Scorpions géants, Salamandre | — | 1-2 | 192 | Écorce de cendre, Verre de cendre, Sel ardent | Khaled Main-Rouge (modèle Pillards des sables, trophée Sceau de Main-Rouge) |
| 3 | Tombeaux ensablés (`tombeaux`) | 20-21 | 3-5 | Momies, Prêtre-scarabée, Ombre du mirage, Djinn mineur | — | 2-2 | 256 | Essence de mirage, Os de dragonnet, Chitine dorée | Grand prêtre Ankhaset (modèle Prêtre-scarabée, trophée Scarabée d’or d’Ankhaset) |
| 4 | Champs de verre (`verrerie`) | 21-22 | 5-7 | Golem de verre, Ver des sables, Djinn mineur, Salamandre | — | 2-2 | 352 | Verre de cendre, Os de dragonnet, Essence de mirage | Ver-Roi des sables (modèle Ver des sables, trophée Perle du Ver-Roi) |
| 5 | Antre du dragon (`antre`) | 23-24 | 9-10 | Salamandre, Scorpions géants, Djinn mineur | Dragon de cendre | 2-3 + 1 garanti | 640 | Os de dragonnet, Verre de cendre, Sel ardent | — |

### 5. Hauteurs de l'Aube : Sanctuaire de l'Aube / Ruines Célestes

Palier 5, niveau minimal 21. Ville : Dernier temple debout au pied des ruines célestes.
Recrutement : Paladin de l'aube, Archonte, Lames jumelles, Tireur astral, Oracle, Chevalier-griffon, Invocatrice des tempêtes, Gardiens célestes.
Marchand : Lame de l'aube, Lance céleste, Sceptre de l'aube, Plate de l'aube, Robe étoilée, Bandage, Potion de soin mineure, Potion de soin, Potion de mana mineure.
Objet de première victoire sur le gardien : Couronne de l'aube. Butin réservé au gardien : Diadème de l'aube. Renfort des monstres : PV ×3.8, attaque et dégâts d’arme ×2.8, gardien ×1.05 en plus.
Territoire : Les marches brisées d'une cité tombée du ciel. L'Archonte déchu y règne encore.

| # | Étape | Niveaux (bonus +2 inclus) | Pop. | Pool de monstres | Imposé | Tirages de butin | Or de base | Matériaux d’étape | Rare |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Marches brisées (`marches`) | 23-24 | 3-4 | Harpies célestes, Gargouilles, Griffon sauvage, Sentinelles de marbre | — | 1-2 | 200 | Plume séraphique, Pierre de lune, Fil de lumière | Griffon aux ailes d’argent (modèle Griffon sauvage, trophée Rémige d’argent) |
| 2 | Parvis des sentinelles (`parvis`) | 24-25 | 4-5 | Sentinelles de marbre, Archers célestes, Gargouilles, Griffon sauvage | — | 1-2 | 300 | Pierre de lune, Éclat astral, Fil de lumière | Sentinelle éveillée (modèle Sentinelles de marbre, trophée Glyphe de vigilance) |
| 3 | Observatoire (`observatoire`) | 25-26 | 3-5 | Astromancien, Spectres de lumière, Ange déchu, Harpies célestes | — | 2-2 | 400 | Poussière d'étoile, Éclat astral, Larme d'aube | Astromancien fou (modèle Astromancien, trophée Astrolabe brisé) |
| 4 | Jardins suspendus (`jardins`) | 26-27 | 5-7 | Chimère, Golem astral, Gardien du seuil, Ange déchu | — | 2-2 | 550 | Larme d'aube, Plume séraphique, Poussière d'étoile | Chimère à trois têtes (modèle Chimère, trophée Corne de chimère) |
| 5 | Trône de l'Archonte (`trone`) | 28-29 | 7-7 | Ange déchu, Spectres de lumière, Archers célestes | Archonte déchu | 2-3 + 1 garanti | 1000 | Éclat astral, Larme d'aube, Plume séraphique | — |

