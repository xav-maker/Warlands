import { loadPrototype } from './load.ts';
const P = loadPrototype();
for (const seed of [0, 1, 42, 4294967295]) {
  const r = new P.Rng(seed);
  console.log(seed, JSON.stringify([r.next(), r.next(), r.next(), r.int(100), r.int(7)]));
}
console.log(P.hash(0), P.hash(42, 'rencontre', 'coeur', 3), P.hash(123456789, 'combat'), P.hash(7, 'é|ü', 12));
