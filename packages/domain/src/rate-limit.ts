/**
 * Limiteur de débit en mémoire, par exemplaire (guide 13.1) : fenêtre glissante d'une minute.
 * Les commandes sensibles (connexion, achat) auront en plus un garde-fou global en base.
 */
export interface RateLimiter {
  /** Compte un appel ; renvoie faux si la limite est dépassée. */
  hit(key: string, perMinute: number): boolean;
}

export function memoryRateLimiter(clock: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();
  let calls = 0;
  return {
    hit(key, perMinute) {
      const now = clock();
      const from = now - 60_000;
      const list = (hits.get(key) ?? []).filter((t) => t > from);
      const ok = list.length < perMinute;
      if (ok) list.push(now);
      hits.set(key, list);
      // Nettoyage occasionnel des clés inactives.
      if (++calls % 1000 === 0) for (const [k, v] of hits) if (!v.some((t) => t > from)) hits.delete(k);
      return ok;
    },
  };
}

export const noRateLimit: RateLimiter = { hit: () => true };
