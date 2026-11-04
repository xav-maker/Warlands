/**
 * Pages et actions du jeu (guide 7.1 et 7.2, J2) : ville, étape de route, combat, sac et banque, marchand,
 * Codex. Formulaires classiques (POST puis redirection) : tout marche sans JavaScript. Une erreur de jeu
 * ramène à la page d'origine avec son message (?e=CODE) ; pendant une rediffusion, vers le combat.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ERROR_CODES, isGameError, messageFr, type ErrorCode } from '@cr/shared';
import type { Db } from '@cr/db';
import {
  advance,
  arrive,
  back,
  bankMove,
  battleView,
  buyPrice,
  depart,
  discard,
  ensureStarted,
  fight,
  gameView,
  goHome,
  merchantBuy,
  merchantSell,
  region,
  route,
  routeTierIndex,
  troopMinPrice,
  searchEncounter,
  sellPrice,
  takeLoot,
  useConsumable,
  engage,
  withdraw,
  rebuyUnits,
  recruit,
  recipeView,
  craft,
  equip,
  unequip,
  workshopOf,
  evolve,
  evolutionPreview,
  questView,
  turnInQuest,
  abandonQuest,
  SHOP,
  RESET_WORD,
  resetGame,
  buyListing,
  listGoods,
  markNotificationsRead,
  myListings,
  notifications,
  priceHistory,
  searchListings,
  withdrawListing,
  scaled,
  setDisabledSkills,
  battleLog,
  DELETE_WORD,
  deleteAccount,
  exportData,
  doorView,
  dungeonView,
  fightRoom,
  leaveDungeon,
  openDungeon,
  spawnTestDoor,
  acceptInvite,
  declineInvite,
  friendsView,
  goSolo,
  invitationsFor,
  inviteDungeon,
  choosePseudo,
  confirmTotp,
  disableTotp,
  startTotp,
  totpState,
  setRank,
  xpToNext,
  type AuthContext,
  type CommandDef,
  type GameContent,
  type GameView,
} from '@cr/domain';
import { basicAttack, canWear, computeStats, itemValue, learned, quality, routes, troopActive } from '@cr/gen';
import type { z } from 'zod';

export interface GameRouteDeps {
  db: Db;
  content: GameContent;
  page(req: FastifyRequest, reply: FastifyReply, view: string, data?: Record<string, unknown>, status?: number): FastifyReply;
  run<S extends z.ZodType, R>(req: FastifyRequest, def: CommandDef<S, R>, input: unknown): Promise<R>;
  requireAuth(req: FastifyRequest): AuthContext;
  /** Limitation de débit (lève RATE_LIMITED) : clé, nombre par minute. */
  limit(key: string, perMinute: number): void;
  /** Outils de test (préproduction) : faire apparaître une porte de donjon. Aucune troupe gratuite. */
  testTools: boolean;
}

/** Libellés lus dans le pack, pour les vues. */
const DMG_LABEL: Record<string, string> = { tenebres: 'ténèbres', sacre: 'sacré' };

export function labels(c: GameContent) {
  const p = c.pack;
  return {
    item: (id: string): string => p.items[id]?.name ?? p.equip[id]?.name ?? id,
    dungeon: (id: string): string => p.dungeons?.find((x) => x.id === id)?.name ?? id,
    troop: (id: string): string => p.troops[id]?.name ?? id,
    skill: (id: string): string => p.skills[id]?.name ?? id,
    /** Immunités d'un monstre (README 19.4), en clair ; vide sans immunité. */
    immune: (id: string): string => (p.troops[id]?.immune ?? []).map((x) => DMG_LABEL[x] ?? x).join(', '),
    isConsumable: (id: string): boolean => p.items[id]?.kind === 'consommable',
    region: (id: string) => region(c, id),
    route: (id: string) => route(c, id),
    quality,
    value: (base: string, roll: number): number => itemValue(p, { uid: '', base, roll, stats: [] }),
    buyPrice: (id: string): number => buyPrice(c, id),
    sellPrice: (id: string): number => sellPrice(c, id),
    sellInstance: (base: string, roll: number): number =>
      Math.max(1, Math.floor(itemValue(p, { uid: '', base, roll, stats: [] }) * Number(p.eco.buyBack))),
    statText: (s: { k: string; v: number; type?: string }): string => {
      const v = s.v * p.itemBoost;
      if (s.k === 'wspeed') return `vitesse de l’arme −${v}`;
      if (s.k === 'wcost') return `coût de l’arme −${v}`;
      if (s.k === 'res') return `+${v} % rés. ${s.type}`;
      return `+${v} ${p.statCost[s.k]?.label ?? s.k}`;
    },
  };
}

/** Chemins de retour autorisés après une action (jamais une URL fournie telle quelle). */
const BACK = new Set(['/ville', '/route', '/donjon', '/sac', '/marchand', '/caserne', '/atelier', '/quetes', '/boutique']);
const backOf = (b: Record<string, string>, fallback: string): string => (BACK.has(b.back ?? '') ? b.back! : fallback);
const errorOf = (q: unknown): string | undefined => {
  const e = (q as Record<string, string | undefined>).e;
  return e && (ERROR_CODES as readonly string[]).includes(e) ? messageFr(e as ErrorCode) : undefined;
};
const int = (v: string | undefined): number => Number.parseInt(v ?? '', 10);

export function registerGameRoutes(app: FastifyInstance, d: GameRouteDeps): void {
  const L = labels(d.content);

  async function view(req: FastifyRequest): Promise<GameView> {
    const auth = d.requireAuth(req);
    await d.run(req, ensureStarted, {});
    return gameView(d.db, d.content, auth.player.id);
  }

  /** Exécute une action ; en cas d'erreur de jeu, redirige vers `back` avec le message. */
  async function act(req: FastifyRequest, reply: FastifyReply, back: string, fn: () => Promise<string | void>): Promise<FastifyReply> {
    try {
      const to = await fn();
      return reply.redirect(to ?? back, 303);
    } catch (e) {
      if (!isGameError(e) || e.code === 'NOT_AUTHENTICATED' || e.code === 'CSRF_INVALID') throw e;
      if (e.code === 'WATCH_IN_PROGRESS') {
        const v = await gameView(d.db, d.content, d.requireAuth(req).player.id);
        if (v.lastBattle) return reply.redirect(`/combat/${v.lastBattle.id}?e=${e.code}`, 303);
      }
      return reply.redirect(`${back}?e=${e.code}`, 303);
    }
  }
  const body = (req: FastifyRequest): Record<string, string> => (req.body ?? {}) as Record<string, string>;
  const goods = (b: Record<string, string>) => (b.instance ? { instance: int(b.instance) } : { item: b.item, qty: int(b.qty) || 1 });

  /** Page de la position du joueur. */
  const home = (v: GameView): string => (v.kind === 'route' ? '/route' : v.kind === 'dungeon' ? '/donjon' : '/ville');

  app.get('/jeu', async (req, reply) => {
    const v = await view(req);
    if (v.watchUntil && v.watchUntil > new Date() && v.lastBattle) return reply.redirect(`/combat/${v.lastBattle.id}`);
    return reply.redirect(home(v));
  });

  // ---------- Ville ----------
  app.get('/ville', async (req, reply) => {
    const v = await view(req);
    if (v.kind !== 'city') return reply.redirect(home(v));
    return d.page(req, reply, 'ville', { v, L, R: region(d.content, v.region), error: errorOf(req.query) });
  });
  app.post('/depart', (req, reply) =>
    act(req, reply, '/ville', async () => {
      const b = body(req);
      await d.run(req, depart, { direction: int(b.direction), ...(b.route ? { route: b.route } : {}) });
      return '/route';
    }),
  );

  // ---------- Route ----------
  app.get('/route', async (req, reply) => {
    const v = await view(req);
    if (v.kind !== 'route' || !v.route) return reply.redirect(home(v));
    const R = route(d.content, v.route.id);
    const me = d.requireAuth(req).player.id;
    const door = await doorView(d.db, d.content, me);
    // Amis à inviter : en ligne, dans la même région (README 23.2).
    const friends = door ? (await friendsView(d.db, me)).friends.filter((f) => f.online && f.region === v.region) : [];
    const testDoor = d.testTools && !door && !!d.content.pack.dungeons?.some((x) => x.route === R.id);
    return d.page(req, reply, 'route', { v, L, R, door, friends, testDoor, home: region(d.content, v.region), error: errorOf(req.query) });
  });

  // ---------- Donjon (README 23) ----------
  app.get('/donjon', async (req, reply) => {
    const v = await view(req);
    const dv = await dungeonView(d.db, d.content, d.requireAuth(req).player.id);
    if (v.kind !== 'dungeon' || !dv) return reply.redirect(home(v));
    const D = d.content.pack.dungeons!.find((x) => x.id === dv.dungeon)!;
    return d.page(req, reply, 'donjon', { v, L, dv, D, R: route(d.content, D.route), error: errorOf(req.query) });
  });
  /** Mode d'entrée ou d'invitation d'un formulaire : seul, un ami (pseudo), ou au hasard. */
  const target = (b: Record<string, string>) =>
    b.mode === 'friend' ? { mode: 'friend', pseudo: b.pseudo ?? '' } : { mode: b.mode ?? 'solo' };
  app.post('/donjon/ouvrir', (req, reply) =>
    act(req, reply, '/route', async () => {
      await d.run(req, openDungeon, target(body(req)));
      return '/donjon';
    }),
  );
  app.post('/donjon/porte-test', (req, reply) => {
    if (!d.testTools) return reply.status(404).send();
    return act(req, reply, '/route', async () => void (await d.run(req, spawnTestDoor, {})));
  });
  app.post('/donjon/inviter', (req, reply) =>
    act(req, reply, '/donjon', async () => void (await d.run(req, inviteDungeon, target(body(req))))),
  );
  app.post('/donjon/seul', (req, reply) => act(req, reply, '/donjon', async () => void (await d.run(req, goSolo, {}))));
  app.get('/donjon/invitation/:run', async (req, reply) => {
    const v = await view(req);
    const runId = int((req.params as { run: string }).run);
    const inv = (await invitationsFor(d.db, d.content, d.requireAuth(req).player.id)).find((x) => x.run === runId) ?? null;
    return d.page(req, reply, 'invitation', { v, L, inv, runId, error: errorOf(req.query) });
  });
  app.post('/donjon/invitation/:run/accepter', (req, reply) => {
    const runId = int((req.params as { run: string }).run);
    return act(req, reply, `/donjon/invitation/${runId}`, async () => {
      await d.run(req, acceptInvite, { run: runId });
      return '/donjon';
    });
  });
  app.post('/donjon/invitation/:run/refuser', (req, reply) => {
    const runId = int((req.params as { run: string }).run);
    return act(req, reply, `/donjon/invitation/${runId}`, async () => {
      await d.run(req, declineInvite, { run: runId });
      return '/jeu';
    });
  });
  const version = (b: Record<string, string>) => (b.version ? { version: int(b.version) } : {});
  app.post('/donjon/combat', (req, reply) =>
    act(req, reply, '/donjon', async () => {
      const r = await d.run(req, fightRoom, version(body(req)));
      // À deux : un vote ; le combat se lance au second.
      return 'battle' in r ? `/combat/${r.battle}` : '/donjon';
    }),
  );
  app.post('/donjon/quitter', (req, reply) =>
    act(req, reply, '/donjon', async () => {
      await d.run(req, leaveDungeon, version(body(req)));
      return '/jeu';
    }),
  );
  const moves: Record<string, CommandDef<z.ZodType, unknown>> = {
    avancer: advance,
    rebrousser: back,
    rentrer: goHome,
    arriver: arrive,
    chercher: searchEncounter,
  } as Record<string, CommandDef<z.ZodType, unknown>>;
  app.post('/route/:action', (req, reply) =>
    act(req, reply, '/route', async () => {
      const def = moves[(req.params as { action: string }).action];
      if (!def) return '/route';
      await d.run(req, def, {});
      return def === goHome || def === arrive ? '/ville' : '/route';
    }),
  );

  // ---------- Combat ----------
  app.post('/combat', (req, reply) =>
    act(req, reply, '/route', async () => {
      const r = await d.run(req, fight, {});
      return `/combat/${r.battle}`;
    }),
  );
  app.get('/combat/:id', async (req, reply) => {
    const v = await view(req);
    const b = await battleView(d.db, d.requireAuth(req).player.id, int((req.params as { id: string }).id));
    if (!b) return d.page(req, reply, 'message', { title: 'Combat introuvable', text: 'Ce combat n’existe pas.' }, 404);
    const isLast = v.lastBattle?.id === b.id;
    const waitMs = isLast && v.watchUntil ? Math.max(0, v.watchUntil.getTime() - Date.now()) : 0;
    const units = (b.input as { units: { id: string; side: number; name: string; hpMax: number; kind: string; skills: string[] }[] }).units;
    const p = d.content.pack;
    // Apparences 8 bits, déduites du type comme dans le prototype (app.ts, registerLooks).
    const looks = Object.fromEntries(
      [...new Set(units.map((u) => u.kind))]
        .filter((k) => p.troops[k])
        .map((k) => {
          const t = p.troops[k]!;
          const st = computeStats(p, t, t.forms[0]!.id, 10);
          const caster = st.manaMax > 0 && p.weapons[t.weapon]?.type !== 'tranchant' && /baton|sceptre|os|spectral/.test(t.weapon);
          return [k, { tags: t.tags, pop: t.pop, units: t.units, caster, weapon: t.weapon, ranged: t.defaultDist >= 3 }];
        }),
    );
    const used = [...new Set(units.flatMap((u) => u.skills))].filter((s) => p.skills[s]);
    const skillNames = Object.fromEntries(used.map((s) => [s, p.skills[s]!.name]));
    // La vue 8 bits choisit ses animations d'après la capacité (cible, portée, type de dégâts).
    const skills = Object.fromEntries(used.map((s) => [s, p.skills[s]!]));
    const replay = {
      journal: `/combat/${b.id}/journal.json`,
      theme: routeTierIndex(d.content, b.route),
      waitMs,
      next: home(v),
      timeLimit: p.params.timeLimit,
      result: b.result,
      skillNames,
      skills,
      looks,
    };
    return d.page(req, reply, 'combat', {
      v,
      L,
      b,
      units,
      r: b.rewards,
      R: route(d.content, b.route),
      waitMs,
      next: home(v),
      // JSON dans un <script type="application/json"> : « < » échappé, rien ne peut fermer la balise.
      replayJson: JSON.stringify(replay).replace(/</g, '\\u003c'),
      error: errorOf(req.query),
    });
  });
  app.get('/combat/:id/journal.json', async (req, reply) => {
    const b = await battleView(d.db, d.requireAuth(req).player.id, int((req.params as { id: string }).id));
    if (!b) return reply.status(404).send({ error: 'introuvable' });
    // Journal effacé (plus de 30 jours) : rejoué depuis l'entrée et la graine si le contenu est le même (guide 15.3).
    const log = battleLog(d.content, b);
    if (!log) return reply.status(410).send({ error: 'journal expiré' });
    return reply
      .header('cache-control', 'private, max-age=86400')
      .type('application/json')
      .send(`{"units":${JSON.stringify((b.input as { units: unknown }).units)},"log":${log}}`);
  });

  // ---------- Butin, sac, banque, consommables ----------
  app.post('/butin/prendre', (req, reply) => act(req, reply, '/route', async () => void (await d.run(req, takeLoot, goods(body(req))))));
  app.post('/sac/jeter', (req, reply) =>
    act(req, reply, backOf(body(req), '/sac'), async () => void (await d.run(req, discard, goods(body(req))))),
  );
  app.get('/sac', async (req, reply) => {
    const v = await view(req);
    const { reserved } = await recipeView(d.db, d.requireAuth(req).player.id);
    return d.page(req, reply, 'sac', { v, L, reserved, error: errorOf(req.query) });
  });
  app.post('/banque', (req, reply) =>
    act(req, reply, '/sac', async () => void (await d.run(req, bankMove, { ...goods(body(req)), from: body(req).from }))),
  );
  app.post('/consommable', (req, reply) => {
    const b = body(req);
    return act(
      req,
      reply,
      backOf(b, '/route'),
      async () => void (await d.run(req, useConsumable, { item: b.item, troop: int(b.troop), unit: int(b.unit) })),
    );
  });

  // ---------- Caserne et troupes ----------
  app.get('/caserne', async (req, reply) => {
    const v = await view(req);
    if (v.kind !== 'city') return reply.redirect('/route');
    const rv = await recipeView(d.db, d.requireAuth(req).player.id);
    return d.page(req, reply, 'caserne', {
      v,
      L,
      R: region(d.content, v.region),
      rv,
      c: d.content.pack,
      xpToNext,
      scaled,
      error: errorOf(req.query),
    });
  });
  app.post('/caserne/recruter', (req, reply) =>
    act(req, reply, '/caserne', async () => void (await d.run(req, recruit, { type: body(req).type }))),
  );
  const troopActs: Record<string, CommandDef<z.ZodType, unknown>> = { engager: engage, retirer: withdraw, racheter: rebuyUnits } as Record<
    string,
    CommandDef<z.ZodType, unknown>
  >;
  app.post('/troupe/:id/:action', (req, reply) => {
    const { id, action } = req.params as { id: string; action: string };
    const b = body(req);
    const back = backOf(b, `/troupe/${int(id)}`);
    return act(req, reply, back, async () => {
      if (action === 'rang') await d.run(req, setRank, { troop: int(id), rank: int(b.rank) });
      else if (action === 'capacites') {
        const skills = Object.keys(b)
          .filter((k) => k.startsWith('off_'))
          .map((k) => k.slice(4));
        await d.run(req, setDisabledSkills, { troop: int(id), skills });
      } else if (troopActs[action]) await d.run(req, troopActs[action]!, { troop: int(id) });
      return back;
    });
  });
  app.get('/troupe/:id', async (req, reply) => {
    const v = await view(req);
    const t = v.troops.find((x) => x.id === int((req.params as { id: string }).id));
    if (!t) return d.page(req, reply, 'message', { title: 'Troupe introuvable', text: 'Cette troupe n’existe pas.' }, 404);
    const p = d.content.pack;
    const def = p.troops[t.type]!;
    const known = learned(def, t.form, t.level);
    const active = troopActive(p, { type: t.type, level: t.level, form: t.form, rank: t.rank, units: [], disabled: t.disabledSkills });
    const slots = p.troopSlots[t.type] ?? {};
    const pool = [
      ...v.bag.instances.map((i) => ({ ...i, from: 'sac' })),
      ...(v.kind === 'city' ? v.bank.instances.map((i) => ({ ...i, from: 'banque' })) : []),
    ];
    const wearable = (slot: string) => pool.filter((i) => p.equip[i.base]?.slot === slot && canWear(p, t.type, t.level, i.base) === null);
    const evolutions = await evolutionPreview(d.db, d.content, d.requireAuth(req).player.id, t);
    const canEvolveHere = v.kind === 'city' && region(d.content, v.region).city.recruit.includes(t.type);
    return d.page(req, reply, 'troupe', {
      v,
      L,
      t,
      def,
      known,
      active,
      base: basicAttack(def),
      xpToNext,
      slots,
      wearable,
      evolutions,
      canEvolveHere,
      error: errorOf(req.query),
    });
  });

  // ---------- Atelier et équipement ----------
  app.get('/atelier', async (req, reply) => {
    const v = await view(req);
    if (v.kind !== 'city') return reply.redirect('/route');
    const R = region(d.content, v.region);
    const q = int((req.query as { p?: string }).p);
    const tier = q >= 1 && q <= 5 ? q : R.tier;
    const rv = await recipeView(d.db, d.requireAuth(req).player.id);
    return d.page(req, reply, 'atelier', {
      v,
      L,
      R,
      rv,
      tier,
      c: d.content.pack,
      workshopOf: (id: string) => workshopOf(d.content, id),
      error: errorOf(req.query),
    });
  });
  app.post('/atelier/fabriquer', (req, reply) => {
    const b = body(req);
    return act(req, reply, `/atelier?p=${int(b.p) || ''}`, async () => {
      await d.run(req, craft, { out: b.out });
      return `/atelier?p=${int(b.p) || ''}`;
    });
  });
  app.post('/troupe/:id/evoluer', (req, reply) => {
    const id = int((req.params as { id: string }).id);
    return act(req, reply, `/troupe/${id}`, async () => void (await d.run(req, evolve, { troop: id, form: body(req).form })));
  });
  app.post('/troupe/:id/equiper', (req, reply) => {
    const id = int((req.params as { id: string }).id);
    const b = body(req);
    return act(
      req,
      reply,
      `/troupe/${id}`,
      async () => void (await d.run(req, equip, { troop: id, unit: int(b.unit), instance: int(b.instance) })),
    );
  });
  app.post('/troupe/:id/desequiper', (req, reply) => {
    const id = int((req.params as { id: string }).id);
    const b = body(req);
    return act(req, reply, `/troupe/${id}`, async () => void (await d.run(req, unequip, { troop: id, unit: int(b.unit), slot: b.slot })));
  });

  // ---------- Quêtes ----------
  app.get('/quetes', async (req, reply) => {
    const v = await view(req);
    const qv = await questView(d.db, d.requireAuth(req).player.id);
    return d.page(req, reply, 'quetes', { v, L, qv, here: v.kind === 'city' ? v.region : null, error: errorOf(req.query) });
  });
  app.post('/quetes/:id/:action', (req, reply) => {
    const { id, action } = req.params as { id: string; action: string };
    return act(req, reply, '/quetes', async () => {
      if (action === 'rendre') await d.run(req, turnInQuest, { quest: int(id) });
      else if (action === 'renoncer') await d.run(req, abandonQuest, { quest: int(id) });
      return '/quetes';
    });
  });

  // ---------- Boutique des joueurs ----------
  app.get('/boutique', async (req, reply) => {
    const v = await view(req);
    if (v.kind !== 'city') return reply.redirect('/route');
    const pid = d.requireAuth(req).player.id;
    const q = req.query as Record<string, string | undefined>;
    const filters = { q: q.q, family: q.f || undefined, tier: int(q.p) || undefined, slot: q.s || undefined, after: q.apres };
    const found = await searchListings(d.db, v.region, filters);
    const mine = await myListings(d.db, pid);
    const troops = v.troops.filter((x) => x.container === 'BARRACKS' && x.units.length && !x.loaned);
    return d.page(req, reply, 'boutique', {
      v,
      L,
      R: region(d.content, v.region),
      found,
      filters,
      mine,
      troops,
      minTroop: (type: string) => troopMinPrice(d.content, type),
      taxPermille: SHOP.taxPermille,
      error: errorOf(req.query),
    });
  });
  app.get('/boutique/historique/:item', async (req, reply) => {
    const v = await view(req);
    if (v.kind !== 'city') return reply.redirect('/route');
    const item = (req.params as { item: string }).item;
    const h = await priceHistory(d.db, v.region, item);
    return d.page(req, reply, 'historique', { v, L, R: region(d.content, v.region), item, h });
  });
  app.post('/boutique/vendre', (req, reply) => {
    const b = body(req);
    const price = int(b.price);
    const input =
      b.kind === 'instance'
        ? { kind: 'instance', instance: int(b.instance), price }
        : b.kind === 'troop'
          ? { kind: 'troop', troop: int(b.troop), price }
          : { kind: 'stack', item: b.item, qty: int(b.qty) || 1, price };
    return act(req, reply, '/boutique', async () => void (await d.run(req, listGoods, input)));
  });
  app.post('/boutique/:id/acheter', (req, reply) =>
    act(req, reply, '/boutique', async () => void (await d.run(req, buyListing, { listing: int((req.params as { id: string }).id) }))),
  );
  app.post('/boutique/:id/retirer', (req, reply) =>
    act(req, reply, '/boutique', async () => void (await d.run(req, withdrawListing, { listing: int((req.params as { id: string }).id) }))),
  );
  app.get('/notifications', async (req, reply) => {
    const v = await view(req);
    const list = await notifications(d.db, d.requireAuth(req).player.id);
    return d.page(req, reply, 'notifications', { v, L, list });
  });
  app.post('/notifications/lues', (req, reply) =>
    act(req, reply, '/notifications', async () => void (await d.run(req, markNotificationsRead, {}))),
  );

  // ---------- Compte : pseudo, double authentification, recommencer la partie, outils de test ----------
  app.get('/compte', async (req, reply) => {
    const v = await view(req);
    const auth = d.requireAuth(req);
    const me = await d.db.selectFrom('player').select('rename_required').where('id', '=', auth.player.id).executeTakeFirstOrThrow();
    return d.page(req, reply, 'compte', {
      v,
      L,
      renameRequired: me.rename_required,
      totp: await totpState(d.db, auth.account.id),
      word: RESET_WORD,
      deleteWord: DELETE_WORD,
      done: (req.query as { ok?: string }).ok,
      error: errorOf(req.query),
    });
  });
  app.post('/compte/recommencer', (req, reply) =>
    act(req, reply, '/compte', async () => {
      await d.run(req, resetGame, { confirm: body(req).confirm });
      return '/ville';
    }),
  );
  // Données personnelles (guide 14) : export JSON, suppression du compte.
  app.get('/compte/donnees.json', async (req, reply) => {
    const auth = d.requireAuth(req);
    d.limit(`export:${auth.account.id}`, 3);
    const data = await exportData(d.db, auth.account.id);
    return reply
      .header('cache-control', 'no-store')
      .header('content-disposition', 'attachment; filename="les-cinq-regions-donnees.json"')
      .type('application/json; charset=utf-8')
      .send(JSON.stringify(data, null, 2));
  });
  app.post('/compte/supprimer', (req, reply) =>
    act(req, reply, '/compte', async () => {
      const b = body(req);
      await d.run(req, deleteAccount, { password: b.password ?? '', confirm: b.confirm ?? '' });
      return '/compte/supprime';
    }),
  );
  app.get('/compte/supprime', (req, reply) =>
    d.page(req, reply, 'message', {
      title: 'Compte supprimé',
      text: 'Votre compte est supprimé : votre adresse, vos messages et votre partie sont effacés. Merci d’avoir joué.',
      link: { href: '/', label: 'Accueil' },
    }),
  );
  app.post('/compte/pseudo', (req, reply) =>
    act(req, reply, '/compte', async () => {
      await d.run(req, choosePseudo, { pseudo: body(req).pseudo ?? '' });
      return '/compte?ok=pseudo';
    }),
  );
  // Double authentification : ce sont des opérations de compte (pas de jeu), hors du cadre des commandes.
  app.post('/compte/2fa/commencer', (req, reply) =>
    act(req, reply, '/compte', async () => {
      await startTotp(d.db, d.requireAuth(req).account.id);
      return '/compte#deux-facteurs';
    }),
  );
  app.post('/compte/2fa/confirmer', (req, reply) =>
    act(req, reply, '/compte', async () => {
      const auth = d.requireAuth(req);
      d.limit(`totp:${auth.account.id}`, 5);
      await confirmTotp(d.db, auth.account.id, body(req).code ?? '', auth.session.id);
      return '/compte?ok=2fa';
    }),
  );
  app.post('/compte/2fa/desactiver', (req, reply) =>
    act(req, reply, '/compte', async () => {
      const auth = d.requireAuth(req);
      d.limit(`totp:${auth.account.id}`, 5);
      await disableTotp(d.db, auth.account.id, body(req).code ?? '');
      return '/compte?ok=2fa-off';
    }),
  );

  // ---------- Marchand ----------
  app.get('/marchand', async (req, reply) => {
    const v = await view(req);
    if (v.kind !== 'city') return reply.redirect('/route');
    return d.page(req, reply, 'marchand', { v, L, R: region(d.content, v.region), error: errorOf(req.query) });
  });
  app.post('/marchand/acheter', (req, reply) =>
    act(req, reply, '/marchand', async () => void (await d.run(req, merchantBuy, { id: body(req).id }))),
  );
  app.post('/marchand/vendre', (req, reply) =>
    act(req, reply, '/marchand', async () => void (await d.run(req, merchantSell, { ...goods(body(req)), from: body(req).from }))),
  );

  // ---------- Codex (contenu public du pack) ----------
  const PARTS = ['regions', 'troupes', 'monstres', 'capacites', 'objets'] as const;
  app.get('/codex', (req, reply) => {
    const q = (req.query as { p?: string }).p;
    const part = (PARTS as readonly string[]).includes(q ?? '') ? q! : 'regions';
    return d.page(req, reply, 'codex', { part, parts: PARTS, c: d.content.pack, L, routes: routes(d.content.pack) });
  });
}
