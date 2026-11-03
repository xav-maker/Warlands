# Contenu cible : le monde (20 régions, 29 routes, 12 donjons)

Complément de la partie II du [README](/mnt/project-files/multijoueur/README-jeu.md) (sections 18 et 23). Tout ce qui est nouveau ici est une proposition [H] construite à partir de la demande de Xavier du 3 novembre 2026 : 15 régions de plus, carte en graphe où chaque région mène à 2 ou 3 autres, donjons propres à certaines routes. Les monstres cités sont définis dans [contenu-cible-unites.md](/mnt/project-files/multijoueur/contenu-cible-unites.md).

## 1. Les 20 régions

Numéros 1 à 5 : régions actuelles, inchangées. Numéros 6 à 20 : nouvelles.

| # | Région | Ville | Palier | Niveau min. | Thème | Routes vers |
|---|---|---|---|---|---|---|
| 1 | Pays de Havre-Gris | Havre-Gris (**départ**) | 1 | 1 | forêt, gobelins | 2, 6, 7 |
| 6 | Val-Moussu | Val-Moussu | 1 | 1 | prairies, collines, moulins, bêtes des champs | 1, 8, 10 |
| 7 | Rives du Saule | Saulnes | 1 | 1 | rivière, saules, fées et esprits de l'eau | 1, 8, 9 |
| 8 | Landes de Bruyère | Fort-Bruyère | 1 | 1 | landes, menhirs, bandits | 6, 7, 11 |
| 2 | Côte de Port-Salant | Port-Salant | 2 | 6 | marais, noyés | 1, 3, 9 |
| 9 | Collines Brumeuses | Brumefosse | 2 | 6 | brume, loups-garous, sorcières | 2, 7, 12 |
| 10 | Val des Tombes | Corbeval | 2 | 6 | cimetières, morts-vivants | 6, 11, 13 |
| 11 | Bois d'Ambre | Ambrerive | 2 | 6 | forêt d'automne, druides corrompus | 8, 10, 14 |
| 3 | Monts de Rochecreuse | Rochecreuse | 3 | 11 | mines, nains, golems | 2, 4, 12 |
| 12 | Pics de Givre | Givrecime | 3 | 11 | montagnes glacées, yétis, géants | 3, 9, 15 |
| 13 | Forêt de Sombrefonds | Lanterne-Noire | 3 | 11 | forêt sans soleil, elfes noirs, araignées | 10, 14, 16 |
| 14 | Hautes-Fumeroles | Braise-Haute | 3 | 11 | volcan, feu, démons mineurs de la forge | 11, 13, 17 |
| 4 | Terres de Cendrelune | Cendrelune | 4 | 16 | désert, dragon | 3, 5, 15 |
| 15 | Archipel des Naufrageurs | Port-Corsaire | 4 | 16 | îles, pirates, nagas | 4, 12, 18 |
| 16 | Jungle de Verdeloin | Verdeloin | 4 | 16 | jungle, serpents, temples | 13, 17, 19 |
| 17 | Steppes de Khar | Kharak | 4 | 16 | steppes, centaures, orcs, tempêtes | 14, 16, 20 |
| 5 | Hauteurs de l'Aube | Sanctuaire de l'Aube | 5 | 21 | ruines célestes | 4, 18 |
| 18 | Abysses d'Ys | Ys-la-Profonde | 5 | 21 | cité engloutie, horreurs des profondeurs | 5, 15, 19 |
| 19 | Marches d'Obsidienne | Citadelle d'Obsidienne | 5 | 21 | démons, verre noir | 16, 18, 20 |
| 20 | Bois-Songe | Lune-Dormante | 5 | 21 | forêt du rêve, fées, cauchemars | 17, 19 |

Vérification : 18 régions ont 3 routes, 2 en ont 2 (Hauteurs de l'Aube et Bois-Songe), soit 29 routes. Toutes les régions sont reliées à Havre-Gris. Le plus court chemin de Havre-Gris à une région de palier 5 traverse 4 routes, comme aujourd'hui.


## 2. Les 29 routes

Palier d'une route = le plus petit des paliers de ses deux régions (README 18.2). Niveaux des étapes (bonus +2 compris) : L+2/L+3, L+3/L+4, L+4/L+5, L+5/L+6, gardien L+7/L+8. Population des étapes : celle de la section 3.2 × 2 (README 20). Monstres : étapes 1 et 2 dans les monstres **légers** des bestiaires des deux régions, étapes 3 et 4 dans les **lourds**, escorte du gardien dans les lourds (les 5 routes actuelles gardent leurs pools). Les 4 monstres rares occupent les étapes 1 à 4, dans l'ordre.

| Route | Relie | Palier | Nom | Étapes 1 → 5 | Gardien (imposé à l'étape 5) | Monstres rares (modèle) | Donjon |
|---|---|---|---|---|---|---|---|
| R01 | 1-2 | 1 | Forêt des Ronces | actuelles | Sylvain des Ronces | actuels | — |
| R02 | 2-3 | 2 | Marais des Noyés | actuelles | Mère des Noyés | actuels | — |
| R03 | 3-4 | 3 | Mines de Fer-Hurlant | actuelles | Cœur-de-Forge | actuels | **Puits sans fond** |
| R04 | 4-5 | 4 | Désert de Cendre | actuelles | Dragon de cendre | actuels | — |
| R05 | 5-18 | 5 | Ruines Célestes | actuelles | Archonte déchu | actuels | **Observatoire inversé** |
| R06 | 1-6 | 1 | Prés de Brande | Haies vives · Champ du meunier · Ruisseau des vaches · Moulin brûlé · Butte du Taureau | Taureau de Brande | Grand-Groin (Sanglier des prés) · Lièvre-Roi (Lièvres cornus) · Bourdon-Reine (Bourdons géants) · Jacques-la-Fourche (Épouvantail animé) | **Terriers du Roi Kobold** |
| R07 | 1-7 | 1 | Gué des Lavandières | Rive basse · Moulin à eau · Gué de pierre · Saulaie · Bassin de la Dame | Dame du Gué | Gros-Ventre (Grenouilles-taureaux) · Mère-Rat (Rats d'eau) · Brume-Fille (Lavandière de nuit) · Croc-de-Vase (Brochet géant) | — |
| R08 | 6-8 | 1 | Collines aux Menhirs | Pâtures hautes · Cercle de pierres · Bergerie vide · Col des Corneilles · Menhir-Roi | Menhir éveillé | Vieux Sanglier gris (Sanglier des prés) · Corneille-Mère (Corneilles noires) · Bélier-Tonnerre (Bélier des landes) · Pierre-qui-marche (Esprit de menhir) | — |
| R09 | 7-8 | 1 | Tourbières de Bruyère | Fondrières · Tourbe noire · Chemin des feux · Îlot des saules · Mare aux Fées | Roi des Farfadets | Grenouille-Taureau d'or (Grenouilles-taureaux) · Malfaisant (Farfadets) · Grand Chien noir (Chiens de bruyère) · Rebouteuse Ma Gorre (Rebouteuse maudite) | **Tertre des Fées** |
| R10 | 6-10 | 1 | Chemin des Pendus | Carrefour · Gibet · Fermes vides · Chapelle profanée · Porte du cimetière | Bourreau sans tête | Brigand Rouge-Gorge (Brigands des haies) · Ours Balafré (Ours brun) · Goule de Gibet (Goules) · Chien d'os (Chien squelette) | — |
| R11 | 7-9 | 1 | Combe aux Brumes | Sous-bois mouillé · Rochers moussus · Pont des brumes · Combe noire · Clairière lunaire | Grande Ondine | Ondine Pâle (Ondine) · Farfadet Nuit-Noire (Farfadets) · Chauve-souris albinos (Chauves-souris géantes) · Corbeau Trois-Yeux (Corbeau de mauvais augure) | — |
| R12 | 8-11 | 1 | Lisière d'Ambre | Ajoncs · Camp des braconniers · Hêtraie rousse · Ruisseau d'ambre · Chêne-Mère | Gardien-Chêne | Chef Coupe-Bourse (Bandits des landes) · Cerf aux bois d'or (Cerf d'ambre) · Guêpe-Reine (Guêpes d'ambre) · Bélier Noir (Bélier des landes) | — |
| R13 | 2-9 | 2 | Falaises du Héron | Grève · Escaliers taillés · Nids de hérons · Phare éteint · Pointe des Naufrages | Héron colossal | Sangsue-Mère (Sangsues géantes) · Chasseur Ombre-Grise (Chasseurs de primes) · Crapaud Bubon (Crapaud géant) · Ours des Brumes blanc (Ours des brumes) | **Grotte des Contrebandiers** |
| R14 | 9-12 | 2 | Sentier des Crêtes | Pâturages brumeux · Bois de pins · Corniche · Cabane du trappeur · Crête du Hurleur | Loup-garou alpha | Loup-garou Gris-Croc (Loup-garou) · Harpie Sans-Plumes (Harpies des neiges) · Le Pendu qui marche (Pendus) · Loup blanc Œil-de-Givre (Loups blancs) | — |
| R15 | 10-13 | 2 | Bois des Lanternes | Allée des tombes · Saules noirs · Lanternes mortes · Ruines elfiques · Arbre aux Pendus | Seigneur Liche des Lanternes | Goule Ventre-Creux (Goules) · Banshee Hurlante (Banshee) · Araignée Mangeuse-de-Lune (Araignée géante) · Fossoyeur Bâtisseur (Fossoyeur dément) | — |
| R16 | 10-11 | 2 | Vieux Cimetière des Chênes | Grille rouillée · Caveaux · Chênes creux · Ossuaire · Mausolée du Druide | Druide-Liche | Squelette Couronné (Squelettes) · Spectre de la Veuve (Spectre) · Ours-Chêne Pourri (Ours-chêne) · Dryade aux larmes noires (Dryade corrompue) | **Crypte des Corbeaux** |
| R17 | 11-14 | 2 | Gorges Fumantes | Bois brûlé · Sources chaudes · Pont de basalte · Gorge rouge · Seuil de lave | Ours de magma | Cerf de braise (Cerf d'ambre) · Druide Cendre-Noire (Druide noir) · Diablotin Rire-Rouge (Diablotins) · Ver Ardent (Vers de magma) | — |
| R18 | 3-12 | 3 | Col du Vent Blanc | Route des nains · Refuge · Glacier bleu · Col · Porte de Givre | Wyrm des neiges | Kobold Fond-de-Mine (Kobolds) · Yéti Barbe-de-Glace (Yéti) · Nain du givre Thorgil (Nains du givre) · Chamane Souffle-Blanc (Chamane du givre) | — |
| R19 | 12-15 | 3 | Glacier Fendu | Crevasses · Moraine · Lac gelé · Épave prise dans la glace · Falaise de banquise | Mammouth de guerre | Loup blanc Croc-Bleu (Loups blancs) · Wendigo Sans-Faim (Wendigo) · Élémentaire Éclat-Noir (Élémentaire de glace) · Géant Ymir le Jeune (Géant du givre) | **Tombeau du Roi des Glaces** |
| R20 | 13-14 | 3 | Grottes Luminescentes | Entrée des spores · Lac phosphorescent · Forêt de cristaux · Nids de vers · Cœur lumineux | Reine des Spores | Champignon-Roi (Champignons-spores) · Tisseuse Œil-Vert (Tisseuse de nuit) · Salamandre de lave Ancienne (Salamandre de lave) · Golem de basalte fêlé (Golem de basalte) | **Ruche de cristal** |
| R21 | 13-16 | 3 | Racines Profondes | Souches géantes · Tunnel de racines · Village elfe noir · Sanctuaire de mousse · Racine-Mère | Ver-Racine | Lame-Nuit l'elfe noire (Elfes noirs bretteurs) · Araignée Veuve-Pâle (Araignée géante) · Ombre Sans-Nom (Ombre rampante) · Mangeur de lanternes Gras (Mangeur de lanternes) | — |
| R22 | 14-17 | 3 | Plaines de Basalte | Coulées refroidies · Geysers · Champ d'obsidienne · Camp orc avancé · Volcan-Sentinelle | Seigneur des Braises | Chien infernal Trois-Gueules (Chiens infernaux) · Pyromancienne Vashti (Pyromancienne cultiste) · Forgeron Main-de-Lave (Forgeron démoniaque) · Élémentaire de feu Ancien (Élémentaire de feu) | — |
| R23 | 4-15 | 4 | Côte des Épaves | Dunes du rivage · Carcasses · Lagune · Fort pirate en ruine · Récif des Naufrageurs | Amiral noyé | Scorpion Bouclier-d'Or (Scorpions géants) · Pirate Borgne-Rouge (Pirates) · Crabe Ermite géant (Crabes géants) · Naga Écaille-de-Nacre (Naga) | **Épave du Léviathan** |
| R24 | 15-18 | 4 | Fosse des Sirènes | Bancs de corail · Grotte marine · Champ de varech · Statues englouties · Bord de la Fosse | Kraken ancien | Sirène corsaire Mélusine (Sirène corsaire) · Requin-garou Mâchoire-Pâle (Requins-garous) · Homme-poisson Prêtre (Hommes-poissons) · Méduse Couronnée (Méduses géantes) | — |
| R25 | 16-17 | 4 | Savane Rouge | Herbes hautes · Point d'eau · Baobabs · Cimetière d'éléphants · Rocher du Lion | Lion-Roi de Khar | Homme-fauve Croc-de-Lune (Hommes-fauves) · Hyène Rieuse (Hyènes) · Gorille Poing-de-Fer (Gorille de guerre) · Centaure Flèche-Noire (Centaures archers) | — |
| R26 | 16-19 | 4 | Temples Étouffés | Lianes · Escaliers de jade · Bassin sacré · Salle des idoles · Autel du Serpent | Quetzal-Serpent | Serpent-roi Écaille-d'Émeraude (Serpent-roi) · Idole Rieuse (Idole de jade) · Plante carnivore Gueule-Rouge (Plante carnivore) · Chamane-crapaud Bouffi (Chamane-crapaud) | **Pyramide de Jade** |
| R27 | 17-20 | 4 | Route des Tempêtes | Steppe grise · Cairns · Plateau venteux · Orée du rêve · Arche des vents | Esprit-Tempête | Orc Brise-Crâne (Orcs pillards) · Harpie Œil-d'Orage (Harpies tempête) · Géant des steppes Borr (Géant des steppes) · Esprit du vent Hurleur (Esprit du vent) | **Tour des Vents** |
| R28 | 18-19 | 5 | Faille Abyssale | Cité engloutie · Avenue des colonnes · Temple de Dagon · Faille · Porte d'obsidienne | Léviathan d'obsidienne | Homme-poisson Roi-des-Fosses (Hommes-poissons) · Oracle noyé Ilsa (Oracle noyé) · Succube Velours (Succube) · Chevalier infernal Mordred (Chevalier infernal) | — |
| R29 | 19-20 | 5 | Pont des Âmes | Remparts noirs · Pont · Gouffre aux âmes · Bois pétrifié · Lisière du rêve | Gardien du Pont | Démon Cornu (Démons mineurs) · Molosse infernal Cerbérin (Molosse infernal) · Cauchemar Sans-Visage (Cauchemar) · Licorne noire Crin-de-Suie (Licorne noire) | **Abîme d'Obsidienne** |

Les 24 gardiens nouveaux sont définis dans `contenu-cible-unites.md` (section 6), avec leurs immunités et leur composant de gardien. Les 96 rares nouveaux suivent la construction de la section 9.1 du README ; leur trophée s'appelle « Trophée de &lt;nom&gt; » [H], valeur `20 × palier²`.

## 3. Les 12 donjons

Chaque donjon : 4 monstres spéciaux (le pool des salles), 3 boss (salles 4, 8, 12, puis on recommence plus fort), 1 matériau propre, 2 objets uniques (non fabricables, butin de boss). Les monstres de donjon sont définis dans `contenu-cible-unites.md` (section 7) ; les objets uniques dans la section 9.

| Donjon | Route | Palier | Monstres spéciaux | Boss 1 · 2 · 3 | Matériau | Objets uniques |
|---|---|---|---|---|---|---|
| Terriers du Roi Kobold | R06 | 1 | Kobolds terrassiers, Kobolds lance-pierres, Taupes géantes, Kobold geomancien | Taupe-Reine · Chef terrassier Gratte-Gratte · Roi Kobold Mille-Galeries | Pépite des terriers | Pioche du Roi Kobold (arme deux mains) · Casque-lanterne (accessoire) |
| Tertre des Fées | R09 | 1 | Farfadets voleurs, Lutins de tourbe, Feux follets dansants, Champignons-fées | Lutin Grand-Chapeau · Fée Mélancolie · Roi des Elfes du Tertre | Poussière de fée | Robe de pétales (armure) · Baguette de saule (orbe) |
| Grotte des Contrebandiers | R13 | 2 | Contrebandiers, Chiens de garde, Noyés du port, Sorcière des quais | Le Borgne Main-Leste · Grosse Berthe la Cantinière · Capitaine Corbac | Rhum noir | Sabre du Capitaine (arme une main) · Longue-vue de Corbac (accessoire) |
| Crypte des Corbeaux | R16 | 2 | Squelettes corbeaux, Goules de crypte, Prêtres cadavériques, Nuée de corbeaux morts | Gardien des os · Abbesse Plume-Noire · Roi Corbeau | Plume d'ossuaire | Masque de corbeau (accessoire) · Faux du Roi Corbeau (arme deux mains) |
| Puits sans fond | R03 | 3 | Nains revenants, Golems de fer rouillé, Vers aveugles, Kobolds fous | Contremaître éternel · Golem-Forge primitif · L'Ombre du Puits | Fer des profondeurs | Marteau du Puits (arme une main) · Plastron sans fond (armure lourde) |
| Ruche de cristal | R20 | 3 | Guêpes de cristal, Larves luisantes, Ouvrières de quartz, Sentinelles prismatiques | Bourdon de quartz · Princesse-Prisme · Reine de cristal | Gelée de cristal | Aiguillon de cristal (arc) · Carapace prismatique (armure moyenne) |
| Tombeau du Roi des Glaces | R19 | 3 | Guerriers gelés, Spectres de givre, Loups de glace, Prêtresses de l'hiver | Chancelier de Givre · Reine Hiver-Pâle · Roi des Glaces | Glace éternelle | Couronne de givre (accessoire) · Lame-Hiver (arme une main) |
| Épave du Léviathan | R23 | 4 | Marins maudits, Crabes d'abysse, Murènes géantes, Sorciers des marées | Bosco Noyé · Sorcière Mare-Noire · Cœur du Léviathan | Écaille de léviathan | Harpon du Léviathan (arme deux mains) · Cape d'écume (armure légère) |
| Pyramide de Jade | R26 | 4 | Momies de jade, Serpents sacrés, Prêtres-jaguars, Gardiens de pierre | Grand Jaguar · Prêtresse Jade-Mort · Dieu-Serpent endormi | Jade ancien | Masque de jade (accessoire) · Sceptre du Serpent (orbe) |
| Tour des Vents | R27 | 4 | Élémentaires d'air, Harpies de la tour, Moines du vent, Gargouilles de bronze | Maître des Courants · Gargouille d'airain · Seigneur des Vents | Plume de tempête | Bottes de tempête (accessoire) · Arc des Quatre Vents (arc) |
| Observatoire inversé | R05 | 5 | Astromanciens déments, Étoiles déchues, Golems d'orrery, Anges sans visage | Gardien de l'Orrery · Astronome Vide-d'Yeux · L'Étoile Noire | Fragment d'étoile noire | Robe de nuit étoilée (robe) · Orbe d'astre mort (orbe) |
| Abîme d'Obsidienne | R29 | 5 | Démons du verre, Âmes captives, Molosses d'obsidienne, Sorciers du gouffre | Geôlier des Âmes · Duchesse de Verre · Prince de l'Abîme | Obsidienne vivante | Lame d'âmes (arme une main) · Armure du Prince (armure lourde) |

## 4. Nouveaux matériaux et composants

Chaque région nouvelle a 4 matériaux de son palier et 1 composant rare (dans le butin de ses monstres lourds). Chaque route nouvelle a un composant de gardien (garanti à la première victoire sur le gardien, puis dans la table du gardien). Valeurs [H] : matériaux 4-6 (palier 1), 10-15 (2), 24-30 (3), 45-55 (4), 85-95 (5) comme aujourd'hui ; composant rare 25 / 35 / 60 / 100 / 110 ; composant de gardien 45 / 60 / 90 / 140 / 180.

| Région | Matériaux (étiquettes) | Composant rare |
|---|---|---|
| 6 Val-Moussu | Laine grasse (fil, bête) · Blé noir (herbe) · Soie de bourdon (fil, essence) · Défense de sanglier (os, bête) | Miel royal |
| 7 Rives du Saule | Écorce de saule (bois, herbe) · Écaille de brochet (cuir, bête) · Galet chantant (pierre, essence) · Roseau tressé (fil, herbe) | Perle d'ondine |
| 8 Landes de Bruyère | Bruyère sèche (herbe, bois) · Cuir de bandit (cuir) · Éclat de menhir (pierre, essence) · Plume de corneille (plume) | Rune de menhir |
| 9 Collines Brumeuses | Fourrure de loup-garou (cuir, bête) · Brume condensée (essence) · Bois de pin noir (bois) · Croc lunaire (os, bête) | Œil de sorcière |
| 10 Val des Tombes | Os poli (os) · Linceul (fil) · Cendre funéraire (essence, pierre) · Clou de cercueil (métal) | Crâne de nécromant |
| 11 Bois d'Ambre | Ambre brut (pierre, essence) · Écorce rousse (bois) · Bois de cerf (os, bête) · Cire de guêpe (essence, herbe) | Cœur de dryade |
| 12 Pics de Givre | Fourrure de yéti (cuir, bête) · Cristal de givre (pierre, essence) · Fer gelé (métal) · Corne de bélier blanc (os) | Larme du glacier |
| 13 Sombrefonds | Soie noire (fil) · Spores luisantes (herbe, essence) · Bois de nuit (bois) · Chitine d'araignée (cuir, os) | Œil de matriarche |
| 14 Hautes-Fumeroles | Basalte (pierre) · Soufre ardent (essence, pierre) · Écaille de salamandre (cuir, bête) · Fer de lave (métal) | Braise éternelle |
| 15 Archipel | Corail rouge (pierre) · Toile de voile (fil) · Écaille de naga (cuir) · Poudre noire (essence) | Perle de kraken |
| 16 Verdeloin | Liane de fer (fil, bois) · Venin d'émeraude (essence, bête) · Bois de teck (bois) · Jade brut (pierre) | Œil de jade |
| 17 Steppes de Khar | Cuir de centaure (cuir) · Herbe à vent (herbe, plume) · Fer orc (métal) · Corne de hyène (os, bête) | Totem du vent |
| 18 Abysses d'Ys | Nacre abyssale (pierre, essence) · Encre de pieuvre (essence) · Algue d'Ys (herbe, fil) · Dent de léviathan (os, bête) | Perle d'Ys |
| 19 Marches d'Obsidienne | Obsidienne (pierre, métal) · Sang de démon (essence) · Cuir infernal (cuir) · Chaîne d'âme (métal, fil) | Cœur de démon |
| 20 Bois-Songe | Pétale de lune (herbe, essence) · Soie de rêve (fil) · Bois d'argent (bois) · Corne de licorne (os) | Larme de songe |

Composants de gardien des routes nouvelles (dans l'ordre R06 → R29) : Corne du Taureau, Voile de la Dame, Cœur de menhir, Couronne de farfadet, Hache du bourreau, Miroir d'ondine, Gland du Chêne-Mère, Plume de héron colossal, Croc d'alpha, Phylactère des Lanternes, Bâton de Druide-Liche, Cœur de magma, Écaille de wyrm, Défense de mammouth, Spore-Reine, Anneau du Ver-Racine, Couronne de braise, Tricorne de l'Amiral, Œil de kraken, Crinière du Lion-Roi, Plume de Quetzal, Souffle captif, Écaille d'obsidienne, Chaîne du Pont.
