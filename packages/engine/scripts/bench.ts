/**
 * Mesure du moteur (guide 4.2, « fini quand » ; 15.1) : N combats v1 sur les entrées de référence migrées,
 * graines variées. Objectif : moins de 20 ms par combat en moyenne.
 *
 *   pnpm --filter @cr/engine bench [N]
 */
import { hash } from '@cr/rng';
import { loadInputs, play } from './golden.ts';

const N = Number(process.argv[2] ?? 10_000);
const inputs = loadInputs();
let events = 0;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const g = inputs[i % inputs.length]!;
  events += play('v1', { ...g, seed: hash(g.seed, 'bench', i) }).log.length;
}
const ms = performance.now() - t0;
console.log(`${N} combats v1 : ${(ms / N).toFixed(2)} ms par combat en moyenne, ${Math.round(events / N)} événements par combat`);
if (ms / N >= 20) process.exitCode = 1;
