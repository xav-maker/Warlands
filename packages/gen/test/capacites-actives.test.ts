/**
 * Capacités actives au-delà de 6 (README 20.1 et 34) : avec `online.activePick: strategy`, on garde l'attaque de base,
 * les passifs, puis les capacités dans l'ordre de priorité de la stratégie par défaut ; le prototype (sans réglage)
 * garde les 5 plus récentes.
 */
import { join } from 'node:path';
import { validateContent } from '@cr/content';
import { describe, expect, it } from 'vitest';
import { defaultActive, formsAvailable, learned, MAX_ACTIVE, newTroop, troopActive } from '../src/index.ts';
import type { GenContent, PlayerTroop } from '../src/index.ts';

const c = validateContent(join(import.meta.dirname, '../../../content')).pack as unknown as GenContent;
const recent = { ...c, online: { ...c.online!, activePick: 'recent' as const } };
const pretre = (level: number, disabled?: string[]): PlayerTroop => ({
  type: 'acolyte',
  level,
  form: 'pretre',
  rank: 3,
  units: [],
  ...(disabled ? { disabled } : {}),
});

describe('capacités actives choisies selon la stratégie (README 34)', () => {
  it('le contenu en ligne choisit selon la stratégie', () => expect(c.online!.activePick).toBe('strategy'));

  it('le Prêtre de niveau 13 garde Soin mineur (les 5 plus récentes le retiraient)', () => {
    expect(learned(c.troops.acolyte!, 'pretre', 13)).toHaveLength(7);
    expect(troopActive(recent, pretre(13))).not.toContain('soin_mineur');
    const act = troopActive(c, pretre(13));
    expect(act).toHaveLength(MAX_ACTIVE);
    expect(act).toContain('soin_mineur');
    expect(act[0]).toBe('emploi');
    // Trait sacré, l'attaque, vient en dernier dans sa stratégie : c'est elle qui sort.
    expect(act).not.toContain('trait_sacre');
  });

  it('une capacité désactivée libère sa place pour la suivante dans l’ordre de la stratégie', () => {
    const act = troopActive(c, pretre(13, ['bouclier_foi']));
    expect(act).not.toContain('bouclier_foi');
    expect(act).toContain('trait_sacre');
    expect(act).toHaveLength(MAX_ACTIVE);
  });

  it('garde toujours l’attaque de base et les passifs, au plus 6 capacités, toutes connues', () => {
    for (const [id, t] of Object.entries(c.troops))
      for (const level of [1, 10, 15, 20, 24, 30])
        for (const f of formsAvailable(t, level)) {
          const known = learned(t, f.id, level);
          const act = defaultActive(t, f.id, level, c);
          expect(act.length, `${id}/${f.id} ${level}`).toBe(Math.min(MAX_ACTIVE, known.length));
          for (const x of act) expect(known).toContain(x);
          expect(act[0]).toBe(known[0]);
          const passives = known.filter((x) => c.skills[x]!.kind !== 'active');
          if (passives.length < MAX_ACTIVE) for (const p of passives) expect(act, `${id}/${f.id} ${level} : ${p}`).toContain(p);
        }
  });

  it('les monstres suivent la même règle ; le prototype (sans réglage) garde les 5 plus récentes', () => {
    expect(newTroop(c, 'acolyte', 13).active).toContain('soin_mineur');
    expect(newTroop(recent, 'acolyte', 13).active).not.toContain('soin_mineur');
  });
});
