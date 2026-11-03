import { describe, expect, it } from 'vitest';
import { Rng, hash } from '../src/index.ts';

// Vecteurs calculés avec le prototype proto-0.4-ville (tools/extract-prototype) : ils ne doivent jamais changer.
const VECTORS: [number, number[]][] = [
  [0, [3809008728, 1133695204, 53579671, 3, 4]],
  [1, [2442144158, 3238099751, 3819917871, 29, 5]],
  [42, [2837322924, 544945897, 479756282, 42, 1]],
  [4294967295, [835879718, 1921286648, 2356205009, 24, 1]],
];

describe('Rng (xoshiro128**)', () => {
  it.each(VECTORS)('graine %i', (seed, expected) => {
    const r = new Rng(seed);
    expect([r.next(), r.next(), r.next(), r.int(100), r.int(7)]).toEqual(expected);
  });

  it('reste dans [0, n[', () => {
    const r = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });
});

describe('hash (FNV-1a)', () => {
  it('donne les valeurs du prototype', () => {
    expect(hash(0)).toBe(2166136261);
    expect(hash(42, 'rencontre', 'coeur', 3)).toBe(2547242138);
    expect(hash(123456789, 'combat')).toBe(3453159168);
    expect(hash(7, 'é|ü', 12)).toBe(2121222944);
  });
});
