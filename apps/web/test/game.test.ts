/**
 * Parcours de jeu par HTTP (J2) : ville, départ, combat, rediffusion imposée, avancer, retour, marchand,
 * banque, Codex. Aléa à graine fixe ; le blocage de rediffusion est levé en base pour ne pas attendre.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Rng } from '@cr/rng';
import { startTestDb, type TestDb } from '@cr/testing';
import { createTroop, memoryMailer, noRateLimit } from '@cr/domain';
import { buildApp } from '../src/app.ts';
import { loadGameContent } from '../src/content.ts';

const APP = 'http://localhost:3000';
const content = loadGameContent();
let t: TestDb;
let app: FastifyInstance;
const rng = new Rng(3);

beforeAll(async () => {
  t = await startTestDb();
  app = await buildApp({
    db: t.db,
    mailer: memoryMailer(),
    appUrl: APP,
    cookieSecure: false,
    logLevel: 'silent',
    rateLimiter: noRateLimit,
    content,
    random: (max) => rng.next() % max,
  });
});
afterAll(async () => {
  await app?.close();
  await t?.stop();
});

const jar = new Map<string, string>();
let csrf = '';
async function req(method: 'GET' | 'POST', url: string, form?: Record<string, string>) {
  const res = await app.inject({
    method,
    url,
    headers: {
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      origin: APP,
      ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(form ? { payload: new URLSearchParams({ _csrf: csrf, ...form }).toString() } : {}),
  });
  for (const c of res.cookies) jar.set(c.name, c.value);
  const m = /name="_csrf" value="([^"]+)"/.exec(res.body);
  if (m) csrf = m[1]!;
  return res;
}
const playerId = async () => (await t.db.selectFrom('player').select('id').executeTakeFirstOrThrow()).id;
const endWatch = async () =>
  t.db
    .updateTable('player')
    .set({ watch_until: new Date(Date.now() - 1000) })
    .execute();

describe('parcours de jeu (J2)', () => {
  it('ouvre la ville de départ après l’inscription', async () => {
    await req('GET', '/inscription');
    await req('POST', '/inscription', { email: 'jeu@example.org', pseudo: 'Aventurier', password: 'motdepasse-long', acceptTos: 'on' });
    await req('GET', '/connexion');
    expect((await req('POST', '/connexion', { email: 'jeu@example.org', password: 'motdepasse-long' })).headers.location).toBe('/jeu');
    const jeu = await req('GET', '/jeu');
    expect(jeu.headers.location).toBe('/ville');
    const city = await req('GET', '/ville');
    expect(city.statusCode).toBe(200);
    expect(city.body).toContain('Havre-Gris');
    expect(city.body).toContain('Forêt des Ronces');
    expect(city.body).toContain('200 or');
    expect(city.body).toContain('Milicien');
  });

  it('part, combat, impose la rediffusion, puis avance', async () => {
    // Escouade pleine de haut niveau, pour un résultat sûr.
    const pid = await playerId();
    await t.db.transaction().execute(async (tx) => {
      await tx.updateTable('troop').set({ container: 'BARRACKS' }).where('player_id', '=', pid).execute();
      for (const type of ['briseur', 'acolyte', 'chasseur', 'milicien', 'frondeurs', 'pyromancien'])
        await createTroop(tx, content, pid, { type, level: 30, container: 'SQUAD', reason: 'test' });
    });
    expect((await req('POST', '/depart', { direction: '1' })).headers.location).toBe('/route');
    const route = await req('GET', '/route');
    expect(route.body).toContain('Lisière');
    expect(route.body).toContain('Combattre');

    const f = await req('POST', '/combat', {});
    expect(f.statusCode).toBe(303);
    const battle = f.headers.location as string;
    expect(battle).toMatch(/^\/combat\/\d+$/);
    const page = await req('GET', battle);
    expect(page.body).toContain('Victoire');
    expect(page.body).toContain('Rediffusion en cours');
    // Sans JavaScript, la page se recharge à la fin du blocage ; avec, la rediffusion prend le relais.
    expect(page.body).toMatch(/<noscript><meta http-equiv="refresh" content="\d+"><\/noscript>/);
    expect(page.body).toContain('/static/combat.js');
    const data = /<script type="application\/json" id="replay-data">([^<]*)<\/script>/.exec(page.body);
    const replay = JSON.parse(data![1]!) as {
      journal: string;
      waitMs: number;
      looks: Record<string, unknown>;
      skillNames: Record<string, string>;
    };
    expect(replay.journal).toBe(`${battle}/journal.json`);
    expect(replay.waitMs).toBeGreaterThan(0);
    expect(Object.keys(replay.looks).length).toBeGreaterThan(0);
    expect(replay.skillNames.emploi).toBe("Emploi d'arme");

    // Pendant la rediffusion, toute action ramène au combat.
    expect((await req('POST', '/route/avancer', {})).headers.location).toBe(`${battle}?e=WATCH_IN_PROGRESS`);
    const journal = JSON.parse((await req('GET', `${battle}/journal.json`)).body) as { units: unknown[]; log: { k: string }[] };
    expect(journal.units.length).toBeGreaterThan(0);
    expect(journal.log.at(-1)!.k).toBe('end');

    await endWatch();
    expect((await req('GET', battle)).body).toContain('Continuer');
    expect((await req('POST', '/route/avancer', {})).headers.location).toBe('/route');
    expect((await req('GET', '/route')).body).toContain('Sentier des pillards');
    expect((await req('POST', '/route/rentrer', {})).headers.location).toBe('/ville');
  });

  it('montre une erreur de jeu sur la page d’origine', async () => {
    const r = await req('POST', '/depart', { direction: '-1' });
    expect(r.headers.location).toBe('/ville?e=NO_SUCH_ROUTE');
    expect((await req('GET', r.headers.location as string)).body).toContain('Aucune route dans ce sens.');
  });

  it('achète au marchand, puis déplace entre banque et sac', async () => {
    const before = await req('GET', '/marchand');
    expect(before.body).toContain('Bandage');
    expect((await req('POST', '/marchand/acheter', { id: 'bandage' })).headers.location).toBe('/marchand');
    expect((await req('POST', '/marchand/acheter', { id: 'lame_1' })).headers.location).toBe('/marchand');
    expect((await req('POST', '/banque', { from: 'BANK', item: 'bandage', qty: '2' })).headers.location).toBe('/sac');
    const sac = await req('GET', '/sac');
    expect(sac.body).toContain('Bandage × 2');
    expect(sac.body).toContain('Épée courte');
    expect(sac.body).toContain('médiocre');
  });

  it('recrute à la caserne, engage et retire, désactive une capacité', async () => {
    const page = await req('GET', '/caserne');
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Acolyte');
    expect((await req('POST', '/caserne/recruter', { type: 'acolyte' })).headers.location).toBe('/caserne');
    const pid = await playerId();
    // L'escouade de haut niveau est pleine : la recrue attend en caserne.
    const acolyte = await t.db
      .selectFrom('troop')
      .selectAll()
      .where('player_id', '=', pid)
      .where('type', '=', 'acolyte')
      .where('level', '=', 1)
      .executeTakeFirstOrThrow();
    expect(acolyte.container).toBe('BARRACKS');
    expect((await req('POST', '/caserne/recruter', { type: 'acolyte' })).headers.location).toBe('/caserne?e=NOT_ENOUGH_ITEMS');
    expect((await req('POST', `/troupe/${acolyte.id}/engager`, { back: '/caserne' })).headers.location).toBe('/caserne?e=SQUAD_FULL');

    const troop = await req('GET', `/troupe/${acolyte.id}`);
    expect(troop.body).toContain('Soin mineur');
    await req('POST', `/troupe/${acolyte.id}/capacites`, { off_soin_mineur: 'on' });
    expect(
      (await t.db.selectFrom('troop').select('disabled_skills').where('id', '=', acolyte.id).executeTakeFirstOrThrow()).disabled_skills,
    ).toEqual(['soin_mineur']);
    await req('POST', `/troupe/${acolyte.id}/rang`, { rank: '2' });
    expect((await t.db.selectFrom('troop').select('rank').where('id', '=', acolyte.id).executeTakeFirstOrThrow()).rank).toBe(2);
  });

  it('sert le Codex, même sans être connecté', async () => {
    jar.clear();
    for (const [p, text] of [
      ['regions', 'Forêt des Ronces'],
      ['troupes', 'Milicien'],
      ['monstres', 'Sylvain des Ronces'],
      ['capacites', 'Boule de feu'],
      ['objets', 'Cœur de ronce'],
    ] as const) {
      const r = await req('GET', `/codex?p=${p}`);
      expect(r.statusCode).toBe(200);
      expect(r.body).toContain(text);
    }
  });
});
