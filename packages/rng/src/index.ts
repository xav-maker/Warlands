/**
 * Aléa déterministe du jeu (guide 4.1, 8.1). Copie à l'identique du prototype proto-0.4-ville :
 * `Rng` (xoshiro128**, graine étalée par splitmix32) vient de engine.ts, `hash` (FNV-1a 32 bits) de gen.ts.
 * Ne pas modifier : les combats de référence et toute graine stockée en dépendent.
 */

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

export class Rng {
  private readonly s = new Uint32Array(4);

  constructor(seed: number) {
    let x = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      x = (x + 2654435769) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 2246822507) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 3266489909) >>> 0;
      this.s[i] = (z ^ (z >>> 16)) >>> 0;
    }
  }

  /** Entier non signé sur 32 bits. */
  next(): number {
    const s = this.s as unknown as [number, number, number, number];
    const r = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return r;
  }

  /** Entier dans [0, n[ (modulo : léger biais accepté, c'est le comportement du prototype). */
  int(n: number): number {
    return this.next() % n;
  }
}

/** FNV-1a sur la graine et les parties jointes par « | ». Dérive les graines (rencontre, combat, butin…). */
export function hash(seed: number, ...parts: (string | number)[]): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
