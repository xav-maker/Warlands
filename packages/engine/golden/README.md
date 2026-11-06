# Combats de référence

| Dossier | Contenu | Produit par |
| --- | --- | --- |
| `v0.4/` | 227 combats joués par le prototype (`proto-0.4-ville`) : entrée, graine, journal complet. C'est la vérité. | `pnpm golden:v0.4` (tools/extract-prototype) |
| `extra/` | 24 combats ciblés sur Embrasement : un lanceur rapide pose des brûlures puis les embrase. Ils sont rares dans les rencontres normales. | `pnpm --filter @cr/engine golden` |
| `proto-0.4.1/`, `proto-0.4.2/`, `v1/`, `v2/` | pour chaque entrée (v0.4 et extra) : empreinte SHA-256 du journal et résultat (`manifest.json`) ; journaux complets des combats qui changent par rapport à la version précédente (`changed/`), à relire | `pnpm --filter @cr/engine golden` |

Une version du moteur corrige une bizarrerie du README 16. Les versions antérieures restent jouables à l'identique : `simuler()` lit `engineVersion` dans l'entrée.

Le script de génération signale tout combat changé qui ne fait pas intervenir la règle corrigée. À la création des versions, il n'y en avait aucun :

| Version | Correction | Combats changés | Vainqueur changé |
| --- | --- | --- | --- |
| `proto-0.4.1` | Embrasement compte les tics restants à la période des brûlures (4) et non des tics globaux (20) | 14 / 251 | 1 |
| `proto-0.4.2` | `allyHpBelow` ne compte plus l'unité elle-même | 54 / 251 | 6 |
| `v1` | jeu cible (README 19), entrées migrées sans changement d'équilibre : les 5 puissances valent l'ancienne attaque, les coefficients 1 000 | 114 / 251 | 9 |
| `v2` | volonté en points de la volonté de référence du combat (README 31) ; l'épuisement n'agit pas, le contenu de référence n'en a pas les paramètres | 249 / 251 | 4 |

Pour Embrasement, l'effet dépasse le « 5 fois » annoncé par le README. Les brûlures ne durent que 12 instants, si bien que l'ancien calcul trouvait presque toujours 0 tic restant. Sur les combats ciblés, les dégâts bruts d'Embrasement passent de 12 à 783.

Pour `v1`, la comparaison ignore l'événement de départ, qui recopie l'entrée migrée. Dans les 114 combats changés, le premier événement qui diverge est toujours un soin, une régénération ou un bouclier, comme l'attend le guide (4.2, étape 4) : avec une migration neutre, seuls les soins et les boucliers changent, puisqu'ils passent en valeurs fixes.

Les règles nouvelles de la v1 (puissances distinctes, immunités, passifs de stats, camp de 16) sont testées une à une dans `test/v1.test.ts`, celles de la v2 (volonté en points, épuisement) dans `test/v2.test.ts`. Pour `v2`, presque tous les combats changent : toute perte de volonté d'une unité dont la volonté max diffère de la moyenne change de valeur. Les propriétés générales du moteur sont dans `test/properties.test.ts` (fast-check, 1 000 cas ; `FC_RUNS=100000` pour la passe de nuit).
