/**
 * L'image installe les dépendances avant de copier les sources : chaque paquet de l'espace de travail doit
 * y avoir sa ligne « COPY …/package.json », sinon pnpm ne le lie pas et la construction de l'image échoue.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');

describe('Dockerfile', () => {
  it('copie le package.json de chaque paquet de l’espace de travail', () => {
    const docker = readFileSync(join(ROOT, 'infra/docker/Dockerfile'), 'utf8');
    const dirs = ['apps', 'packages', 'tools'].flatMap((d) =>
      readdirSync(join(ROOT, d))
        .filter((x) => existsSync(join(ROOT, d, x, 'package.json')))
        .map((x) => `${d}/${x}`),
    );
    const missing = dirs.filter((d) => !docker.includes(`COPY ${d}/package.json ${d}/`));
    expect(missing).toEqual([]);
  });
});
