/**
 * Flux temps réel (guide 10.1) : `GET /events`, Server-Sent Events, un flux par onglet.
 *
 * Abonnements d'un flux : `user:<joueur>` et `region:<région courante>`. Un déplacement du joueur
 * (`player.moved`) fait relire sa position : le flux change de région et prévient le client (`resubscribe`).
 * Toutes les 25 s, un battement de cœur maintient la connexion à travers les proxys, revérifie la session
 * (déconnexion, suspension : le flux se ferme) et prolonge la présence du joueur (`getAuth` met
 * `player.last_seen_at` à jour au plus une fois par minute : « en ligne » = vu il y a moins de 2 minutes).
 *
 * Les événements du domaine ne sont pas relayés tels quels : seuls ceux qui ont un sens pour le navigateur
 * le sont, sous une forme sûre (`toClient`). Le client recharge l'état serveur à la reconnexion (`cr:resync`),
 * ce qui remplace un rejeu d'événements : la base reste la source de vérité.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Bus, BusEvent, Db } from '@cr/db';
import { getAuth } from '@cr/domain';

export interface EventsDeps {
  db: Db;
  bus: Bus;
  /** Jeton de session lu dans le cookie. */
  token(req: FastifyRequest): string | undefined;
  heartbeatMs?: number;
}

/** Flux simultanés autorisés par joueur (onglets) : le plus ancien est fermé au-delà. */
export const MAX_STREAMS_PER_PLAYER = 5;

interface Stream {
  playerId: number;
  region: string;
  token: string;
  write(chunk: string): void;
  end(): void;
}

/** Ce que le navigateur reçoit pour un événement du domaine (`null` : rien). */
export function toClient(e: BusEvent): { event: string; data: Record<string, unknown> } | null {
  switch (e.type) {
    case 'shop.sold':
      return { event: 'notify', data: { text: 'Une de vos annonces vient d’être vendue.', href: '/notifications' } };
    case 'notify':
      return { event: 'notify', data: e.data ?? {} };
    default:
      // Événements sociaux (chat, messages, amis, sanctions, renommage) : transmis tels quels à leurs abonnés.
      return /^(chat|dm|friend|sanction|pseudo|dungeon)\./.test(e.type) ? { event: e.type, data: e.data ?? {} } : null;
  }
}

const frame = (event: string, data: unknown): string => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export function registerEvents(app: FastifyInstance, d: EventsDeps): { streams(): number } {
  const streams = new Set<Stream>();

  const send = (s: Stream, event: string, data: unknown): void => s.write(frame(event, data));

  async function refresh(s: Stream): Promise<boolean> {
    const a = await getAuth(d.db, s.token);
    if (!a) return false;
    if (a.player.pos_region !== s.region) {
      s.region = a.player.pos_region;
      send(s, 'resubscribe', { region: s.region });
    }
    return true;
  }

  const off = d.bus.subscribe((e) => {
    for (const s of streams) {
      if (e.topic === `user:${s.playerId}`) {
        if (e.type === 'player.moved') {
          void refresh(s).catch(() => {});
          continue;
        }
      } else if (e.topic !== `region:${s.region}`) continue;
      const out = toClient(e);
      if (out) send(s, out.event, out.data);
    }
  });

  app.get('/events', (req, reply) => {
    const auth = req.auth;
    if (!auth) return reply.code(401).header('cache-control', 'no-store').send();
    const token = d.token(req);
    if (!token) return reply.code(401).send();

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'x-content-type-options': 'nosniff',
    });

    const s: Stream = {
      playerId: auth.player.id,
      region: auth.player.pos_region,
      token,
      write: (chunk) => {
        if (!raw.writableEnded && !raw.destroyed) raw.write(chunk);
      },
      end: () => {
        clearInterval(timer);
        streams.delete(s);
        if (!raw.writableEnded) raw.end();
      },
    };

    // Trop d'onglets : on ferme le plus ancien.
    const mine = [...streams].filter((x) => x.playerId === s.playerId);
    while (mine.length >= MAX_STREAMS_PER_PLAYER) mine.shift()?.end();

    streams.add(s);
    raw.write('retry: 3000\n\n');
    send(s, 'ready', { region: s.region });
    raw.on('close', () => s.end());

    const timer = setInterval(() => {
      refresh(s)
        .then((ok) => (ok ? s.write(': ping\n\n') : s.end()))
        .catch(() => s.end());
    }, d.heartbeatMs ?? 25_000);
  });

  app.addHook('onClose', async () => {
    off();
    for (const s of [...streams]) s.end();
  });

  return { streams: () => streams.size };
}
