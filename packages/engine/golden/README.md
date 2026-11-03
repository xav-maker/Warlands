# Combats de référence

| Dossier | Contenu | Produit par |
| --- | --- | --- |
| `v0.4/` | 227 combats joués par le prototype (`proto-0.4-ville`) : entrée, graine, journal complet. C'est la vérité. | `pnpm golden:v0.4` (tools/extract-prototype) |
| `extra/` | 24 combats ciblés sur Embrasement : un lanceur rapide pose des brûlures puis les embrase. Ils sont rares dans les rencontres normales. | `pnpm --filter @cr/engine golden` |
| `proto-0.4.1/`, `proto-0.4.2/` | pour chaque entrée (v0.4 et extra) : empreinte SHA-256 du journal et résultat (`manifest.json`) ; journaux complets des combats qui changent par rapport à la version précédente (`changed/`), à relire | `pnpm --filter @cr/engine golden` |

Une version du moteur corrige une bizarrerie du README 16. Les versions antérieures restent jouables à l'identique : `simuler()` lit `engineVersion` dans l'entrée.

Le script de génération signale tout combat changé qui ne fait pas intervenir la règle corrigée. À la création des versions, il n'y en avait aucun :

| Version | Correction | Combats changés | Vainqueur changé |
| --- | --- | --- | --- |
| `proto-0.4.1` | Embrasement compte les tics restants à la période des brûlures (4) et non des tics globaux (20) | 14 / 251 | 1 |
| `proto-0.4.2` | `allyHpBelow` ne compte plus l'unité elle-même | 54 / 251 | 6 |

Pour Embrasement, l'effet dépasse le « 5 fois » annoncé par le README. Les brûlures ne durent que 12 instants, si bien que l'ancien calcul trouvait presque toujours 0 tic restant. Sur les combats ciblés, les dégâts bruts d'Embrasement passent de 12 à 783.
