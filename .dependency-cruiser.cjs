/** Règles de dépendance entre paquets (guide 3.2). */
module.exports = {
  forbidden: [
    {
      name: 'noyau-pur',
      comment: 'engine, rng et content ne dépendent de rien d’autre du dépôt.',
      severity: 'error',
      from: { path: '^packages/(engine|rng|content)/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/(engine|rng|content)/' },
    },
    {
      name: 'gen-pur',
      comment: 'gen ne dépend que du moteur, de l’aléa et du contenu (fonctions pures, guide 4.1).',
      severity: 'error',
      from: { path: '^packages/gen/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/(gen|engine|rng|content)/' },
    },
    {
      name: 'paquets-sans-apps',
      comment: 'Un paquet n’importe jamais une application.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'testing-hors-prod',
      comment: '@cr/testing ne sert qu’aux tests.',
      severity: 'error',
      from: { path: '^(packages|apps)/[^/]+/src/', pathNot: '^packages/testing/' },
      to: { path: '^packages/testing/' },
    },
    { name: 'pas-de-cycle', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|node_modules)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    combinedDependencies: true,
  },
};
