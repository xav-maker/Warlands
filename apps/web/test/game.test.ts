/**
 * Parcours de jeu par HTTP (J2) : ville, départ, combat, rediffusion imposée, avancer, retour, marchand,
 * banque, Codex. Aléa à graine fixe ; le blocage de rediffusion est levé en base pour ne pas attendre.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Rng } from '@cr/rng';
import { startTestDb, type TestDb } from '@cr/testing';
import { addStack, createTroop, memoryMailer, noRateLimit, recipes } from '@cr/domain';
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
    expect(city.body).toContain('1000 or');
    // Fichiers statiques versionnés : un navigateur ne garde pas un ancien script après un déploiement.
    expect(city.body).toContain('/static/app.css?v=dev');
    expect(city.body).toContain('/static/events.js?v=dev');
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
    // Ce qui est à la portée du joueur ressort en vert ; le reste est grisé, bouton désactivé.
    const offer = (html: string, name: string) => {
      const i = html.indexOf(`<span class="title">${name}</span>`);
      return html.slice(html.lastIndexOf('<li class="offer', i), html.indexOf('</li>', i));
    };
    expect(offer(before.body, 'Bandage')).toContain('offer ok');
    expect(offer(before.body, 'Bandage')).toMatch(/class="buy">Acheter/);
    expect((await req('POST', '/marchand/acheter', { id: 'bandage' })).headers.location).toBe('/marchand');
    // Troupe vendue par le marchand de Havre-Gris : un Milicien pour 300 or.
    expect(before.body).toContain('action="/marchand/troupe"');
    expect(offer(before.body, 'Milicien')).toContain('300 or');
    expect((await req('POST', '/marchand/troupe', { type: 'milicien' })).headers.location).toBe('/marchand');
    expect((await req('POST', '/marchand/troupe', { type: 'chasseur' })).headers.location).toBe('/marchand?e=NOT_SOLD_HERE');
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
    // Recettes : chaque ingrédient en pastille, verte si assez, rouge sinon ; l'offre possible ressort en vert.
    expect(page.body).toMatch(/class="chip (ok|ko)"/);
    expect(page.body).toMatch(/<li class="offer (ok|partial|none)"/);
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

  it('fabrique à l’atelier, puis équipe et retire depuis la page de troupe', async () => {
    const pid = await playerId();
    expect((await req('GET', '/atelier?p=1')).body).toContain('Épée courte');
    await t.db.transaction().execute(async (tx) => {
      const seed = (await tx.selectFrom('player').select('seed').where('id', '=', pid).executeTakeFirstOrThrow()).seed;
      const r = (await recipes(tx, content, { id: pid, seed })).get('lame_1')!;
      for (const [item, q] of r.ingredients) await addStack(tx, content, pid, 'BANK', item, q, 'SYSTEM', 'test');
    });
    expect((await req('POST', '/atelier/fabriquer', { out: 'lame_1', p: '1' })).headers.location).toBe('/atelier?p=1');
    const sword = await t.db
      .selectFrom('item_instance')
      .select('id')
      .where('player_id', '=', pid)
      .where('base', '=', 'lame_1')
      .where('container', '=', 'BANK')
      .orderBy('id', 'desc')
      .executeTakeFirstOrThrow();
    const milicien = await t.db
      .selectFrom('troop')
      .select('id')
      .where('player_id', '=', pid)
      .where('type', '=', 'milicien')
      .where('container', '=', 'SQUAD')
      .executeTakeFirstOrThrow();
    const page = await req('GET', `/troupe/${milicien.id}`);
    expect(page.body).toContain('Équiper');
    // Milicien de niveau 30 dans sa ville de recrutement : l'évolution vers le Fantassin est proposée.
    expect(page.body).toContain('Fantassin');
    expect(page.body).toContain('Évoluer');
    await req('POST', `/troupe/${milicien.id}/equiper`, { unit: '1', instance: String(sword.id) });
    expect(
      (await t.db.selectFrom('item_instance').select('container').where('id', '=', sword.id).executeTakeFirstOrThrow()).container,
    ).toBe('EQUIPPED');
    expect((await req('GET', `/troupe/${milicien.id}`)).body).toContain('Retirer');
    await req('POST', `/troupe/${milicien.id}/desequiper`, { unit: '1', slot: 'arme' });
    expect(
      (await t.db.selectFrom('item_instance').select('container').where('id', '=', sword.id).executeTakeFirstOrThrow()).container,
    ).toBe('BANK');
    // Les matériaux réservés à l'échange sont signalés dans le sac.
    const reserved = (
      await t.db.selectFrom('player_reserved_material').select('item').where('player_id', '=', pid).executeTakeFirstOrThrow()
    ).item;
    await t.db.transaction().execute((tx) => addStack(tx, content, pid, 'BAG', reserved, 1, 'SYSTEM', 'test'));
    expect((await req('GET', '/sac')).body).toContain('inutile pour vous');
  });

  it('affiche les quêtes de chaque ville, rendables dans la ville actuelle', async () => {
    const r = await req('GET', '/quetes');
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('Havre-Gris (vous y êtes)');
    expect(r.body).toContain('Port-Salant');
    expect(r.body).toContain('Renoncer (10 or)');
  });

  it('met en vente à la boutique, retrouve l’annonce, la retire', async () => {
    expect((await req('POST', '/boutique/vendre', { kind: 'stack', item: 'bandage', qty: '3', price: '2' })).headers.location).toBe(
      '/boutique?e=PRICE_TOO_LOW',
    );
    expect((await req('POST', '/boutique/vendre', { kind: 'stack', item: 'bandage', qty: '1', price: '25' })).headers.location).toBe(
      '/boutique',
    );
    const page = await req('GET', '/boutique?q=band');
    expect(page.body).toContain('Bandage');
    expect(page.body).toContain('votre annonce');
    expect((await req('GET', '/boutique?q=introuvable')).body).toContain('Aucune annonce ne correspond');
    const l = await t.db.selectFrom('shop_listing').select('id').where('status', '=', 'active').executeTakeFirstOrThrow();
    expect((await req('POST', `/boutique/${l.id}/retirer`, {})).headers.location).toBe('/boutique');
    expect((await t.db.selectFrom('shop_listing').select('status').where('id', '=', l.id).executeTakeFirstOrThrow()).status).toBe(
      'withdrawn',
    );
    expect((await req('GET', '/boutique/historique/bandage')).body).toContain('Aucune vente récente');
  });

  it('recommence la partie depuis la page Compte ; pas d’outils de test sans ENABLE_TEST_TOOLS', async () => {
    const page = await req('GET', '/compte');
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Recommencer la partie');
    expect(page.body).not.toContain('Outils de test');
    expect((await req('POST', '/compte/escouade-test', {})).statusCode).toBe(404); // aucune troupe gratuite, même en test
    expect((await req('POST', '/compte/recommencer', { confirm: 'non' })).headers.location).toMatch(/^\/compte\?e=/);
    await endWatch();
    expect((await req('POST', '/compte/recommencer', { confirm: 'RECOMMENCER' })).headers.location).toBe('/ville');
    const city = await req('GET', '/ville');
    expect(city.body).toContain('Havre-Gris');
    expect(city.body).toContain('1000 or');
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
    // Donjons (README 23) : sur leur route, et leurs boss parmi les monstres.
    expect((await req('GET', '/codex?p=regions')).body).toContain('Donjon : Terriers du Roi Kobold');
    expect((await req('GET', '/codex?p=monstres')).body).toContain('Taupe-Reine</b> (boss de donjon)');
  });
});
